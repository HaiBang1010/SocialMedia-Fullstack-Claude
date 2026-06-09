import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { s3Client } from '../../lib/s3';
import { env } from '../../config/env';
import { publicUserSelect } from '../users/users.service';
import { isFollowing } from '../follows/follows.service';
import type { CreateStoryInput } from './stories.schema';
import type { PaginationInput } from '../posts/posts.schema';

// Stories expire 24h after creation (see ARCHITECTURE §6). The expiry cron that
// flips isArchived arrives in Phase 4.4; until then the time filter alone hides
// expired stories.
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

// include dùng chung cho mọi response trả 1 story.
const storyInclude = {
  author: { select: publicUserSelect },
  // Phase 4.3a overlays. select (not raw) so we never leak storyId; render/z-order = the
  // returned array order (insertion order). orderBy id for a stable, deterministic sequence.
  items: {
    select: { id: true, type: true, x: true, y: true, scale: true, rotation: true, payload: true },
    orderBy: { id: 'asc' },
  },
  // Phase 4.4 — view count. Owner-only at serialize time (never leaked to non-owners).
  _count: { select: { views: true } },
} satisfies Prisma.StoryInclude;

type StoryRow = Prisma.StoryGetPayload<{ include: typeof storyInclude }>;

/**
 * Transform a Prisma story into the API DTO. WHITELIST: never leak mediaObjectKey /
 * thumbnailObjectKey (S3 internals) — unlike serializePost which spreads raw media.
 * author keeps its Date — res.json() serializes to ISO at the HTTP layer (project convention).
 *
 * viewCount is OWNER-ONLY (Phase 4.4): null for non-owners so feed / other-users responses
 * never leak how many people viewed someone else's story. Callers thread viewerId; the feed
 * excludes self, so feed always yields null here.
 */
function serializeStory(story: StoryRow, options: { isViewedByMe: boolean; viewerId?: string }) {
  const isOwner = !!options.viewerId && story.authorId === options.viewerId;
  return {
    id: story.id,
    authorId: story.authorId,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    thumbnailUrl: story.thumbnailUrl,
    duration: story.duration,
    width: story.width,
    height: story.height,
    createdAt: story.createdAt.toISOString(),
    expiresAt: story.expiresAt.toISOString(),
    author: story.author,
    items: story.items.map((i) => ({
      id: i.id,
      type: i.type,
      x: i.x,
      y: i.y,
      scale: i.scale,
      rotation: i.rotation,
      payload: i.payload,
    })),
    isViewedByMe: options.isViewedByMe,
    viewCount: isOwner ? story._count.views : null,
  };
}

/** Story ids the viewer has already seen, among the given set (single query, no N+1). */
async function seenStoryIds(viewerId: string, storyIds: string[]): Promise<Set<string>> {
  if (storyIds.length === 0) return new Set();
  const rows = await prisma.storyView.findMany({
    where: { viewerId, storyId: { in: storyIds } },
    select: { storyId: true },
  });
  return new Set(rows.map((r) => r.storyId));
}

/**
 * Tạo story. expiresAt = now + 24h. KHÔNG verify object S3 tồn tại (tin client).
 */
export async function createStory(authorId: string, input: CreateStoryInput) {
  const story = await prisma.story.create({
    data: {
      authorId,
      mediaUrl: input.mediaUrl,
      mediaObjectKey: input.mediaObjectKey,
      mediaType: input.mediaType,
      thumbnailUrl: input.thumbnailUrl ?? null,
      thumbnailObjectKey: input.thumbnailObjectKey ?? null,
      duration: input.duration ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      expiresAt: new Date(Date.now() + STORY_TTL_MS),
      // Phase 4.3a overlays. Nested-create preserves array order (cuid counter is monotonic
      // per process → matches storyInclude's orderBy id), so z-order survives the round-trip.
      items: input.items.length
        ? {
            create: input.items.map((i) => ({
              type: i.type,
              x: i.x,
              y: i.y,
              scale: i.scale,
              rotation: i.rotation,
              payload: i.payload,
            })),
          }
        : undefined,
    },
    include: storyInclude,
  });

  // Author's own brand-new story → not yet viewed, owner sees viewCount 0.
  return serializeStory(story, { isViewedByMe: false, viewerId: authorId });
}

/**
 * Stories feed: active stories from users the viewer follows, grouped by author.
 * Each group's stories are oldest-first (chronological playback). Groups are sorted
 * unseen-first, then by latest activity (IG ordering). hasUnseenStory drives the
 * StoryBar ring color. Follows the following-set pattern of feed.service.
 */
export async function getStoriesFeed(viewerId: string) {
  const follows = await prisma.follow.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  const followingIds = follows.map((f) => f.followingId);
  if (followingIds.length === 0) {
    return { items: [] };
  }

  const stories = await prisma.story.findMany({
    where: {
      authorId: { in: followingIds },
      isArchived: false,
      expiresAt: { gt: new Date() },
    },
    include: storyInclude,
    orderBy: { createdAt: 'asc' },
  });

  const seen = await seenStoryIds(
    viewerId,
    stories.map((s) => s.id),
  );

  // Group by author, preserving each author's chronological story order.
  const groups = new Map<string, { user: StoryRow['author']; stories: StoryRow[] }>();
  for (const story of stories) {
    let group = groups.get(story.authorId);
    if (!group) {
      group = { user: story.author, stories: [] };
      groups.set(story.authorId, group);
    }
    group.stories.push(story);
  }

  const grouped = [...groups.values()].map((group) => {
    const serialized = group.stories.map((s) =>
      // viewerId never equals the author here (feed excludes self) → viewCount stays null.
      serializeStory(s, { isViewedByMe: seen.has(s.id), viewerId }),
    );
    return {
      user: group.user,
      stories: serialized,
      hasUnseenStory: serialized.some((s) => !s.isViewedByMe),
      latest: group.stories[group.stories.length - 1]!.createdAt.getTime(),
    };
  });

  // Unseen groups first, then most-recent activity first.
  grouped.sort((a, b) => {
    if (a.hasUnseenStory !== b.hasUnseenStory) return a.hasUnseenStory ? -1 : 1;
    return b.latest - a.latest;
  });

  return {
    items: grouped.map((g) => ({
      user: g.user,
      stories: g.stories,
      hasUnseenStory: g.hasUnseenStory,
    })),
  };
}

/**
 * Active stories of a single user (for the viewer / profile). Privacy mirrors
 * listPostsByUsername: a private account hides its stories from non-owner
 * non-followers (empty list, NOT 404 — the user exists). Oldest-first.
 */
export async function listStoriesByUsername(username: string, viewerId?: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isPrivate: true },
  });
  if (!user) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }

  const isOwner = viewerId === user.id;
  let viewerFollows = false;
  if (viewerId && !isOwner) {
    viewerFollows = await isFollowing(viewerId, user.id);
  }

  // Private account: only the owner + followers may see the stories.
  if (user.isPrivate && !isOwner && !viewerFollows) {
    return { stories: [] };
  }

  const stories = await prisma.story.findMany({
    where: { authorId: user.id, isArchived: false, expiresAt: { gt: new Date() } },
    include: storyInclude,
    orderBy: { createdAt: 'asc' },
  });

  const seen = viewerId
    ? await seenStoryIds(
        viewerId,
        stories.map((s) => s.id),
      )
    : new Set<string>();

  return {
    // Owner viewing own stories → viewCount numbers; non-owner → null.
    stories: stories.map((s) => serializeStory(s, { isViewedByMe: seen.has(s.id), viewerId })),
  };
}

/**
 * Mark a story as viewed by the viewer. Idempotent (upsert on the composite PK).
 * 404 if the story doesn't exist or is no longer active (expired/archived).
 * The author viewing their own story is NOT recorded (IG behavior) — keeps the
 * owner out of the viewers list + viewCount.
 */
export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { authorId: true, expiresAt: true, isArchived: true },
  });
  if (!story || story.isArchived || story.expiresAt <= new Date()) {
    throw new AppError(404, 'StoryNotFound', 'Story not found');
  }

  // A self-view doesn't count — never record the author as a viewer of their own story.
  if (story.authorId === viewerId) return;

  await prisma.storyView.upsert({
    where: { storyId_viewerId: { storyId, viewerId } },
    create: { storyId, viewerId },
    update: {},
  });
}

/**
 * Xóa story (cascade xóa StoryView) + best-effort xóa object S3 (media + poster nếu video).
 * Non-owner → 403. S3 delete fail → log, KHÔNG throw (DB delete đã commit).
 */
export async function deleteStory(storyId: string, userId: string): Promise<void> {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { authorId: true, mediaObjectKey: true, thumbnailObjectKey: true },
  });
  if (!story) {
    throw new AppError(404, 'StoryNotFound', 'Story not found');
  }
  if (story.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only delete your own stories');
  }

  // Cascade (onDelete: Cascade) tự xóa StoryView rows.
  await prisma.story.delete({ where: { id: storyId } });

  const keys = story.thumbnailObjectKey
    ? [story.mediaObjectKey, story.thumbnailObjectKey]
    : [story.mediaObjectKey];
  for (const key of keys) {
    try {
      await s3Client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    } catch (err) {
      console.error(`[deleteStory] Failed to delete S3 object ${key}:`, err);
    }
  }
}

/**
 * Cron sweep (Phase 4.4): flip isArchived on stories whose 24h window has passed.
 * Idempotent — the `isArchived: false` guard means an already-archived story is never
 * touched twice. Returns the number of rows archived (for the job's log line).
 */
export async function archiveExpiredStories(): Promise<{ count: number }> {
  const { count } = await prisma.story.updateMany({
    where: { isArchived: false, expiresAt: { lt: new Date() } },
    data: { isArchived: true },
  });
  return { count };
}

/**
 * The viewer's own archived stories (GET /stories/archive). Newest-first, cursor on id
 * (mirrors listPostsByUsername). Always the owner → viewCount is populated.
 */
export async function listArchivedStories(userId: string, pagination: PaginationInput) {
  const { cursor, limit } = pagination;

  const rows = await prisma.story.findMany({
    where: { authorId: userId, isArchived: true },
    include: storyInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  return {
    stories: slice.map((s) =>
      // Archived stories are always seen; owner always sees viewCount.
      serializeStory(s, { isViewedByMe: true, viewerId: userId }),
    ),
    nextCursor,
  };
}

/**
 * List who viewed a story (GET /stories/:id/views) — OWNER ONLY. Most-recent first.
 * Composite-PK cursor on viewerId (mirrors listFollowers), backed by the
 * [storyId, viewedAt desc] index. Does NOT filter active: an owner must be able to see
 * the viewers of an already-archived story.
 */
export async function listStoryViewers(
  storyId: string,
  viewerId: string,
  pagination: PaginationInput,
) {
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { authorId: true },
  });
  if (!story) {
    throw new AppError(404, 'StoryNotFound', 'Story not found');
  }
  if (story.authorId !== viewerId) {
    throw new AppError(403, 'Forbidden', 'You can only see viewers of your own stories');
  }

  const { cursor, limit } = pagination;

  const rows = await prisma.storyView.findMany({
    where: { storyId },
    include: { viewer: { select: publicUserSelect } },
    orderBy: { viewedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { storyId_viewerId: { storyId, viewerId: cursor } }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.viewerId : null;

  return {
    viewers: slice.map((r) => ({ user: r.viewer, viewedAt: r.viewedAt.toISOString() })),
    nextCursor,
  };
}
