import { Prisma, PostVisibility } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { isFollowing } from '../follows/follows.service';
import type { UpdateProfileInput, GroupableQueryInput } from './users.schema';

// Exported để các module khác (vd posts) reuse cho phần `author` —
// đảm bảo KHÔNG bao giờ lộ email/passwordHash.
export const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  bio: true,
  avatarUrl: true,
  isPrivate: true,
  createdAt: true,
} as const;

/**
 * Public profile DTO for GET /users/:username — the 7 public fields plus social
 * counts and the viewer's follow relationship. `viewerId` is the (optional) id
 * of the requester (optionalAuth on the route).
 *
 * - followersCount / followingCount: full counts (viewer-independent).
 * - postsCount: mirrors what the profile grid (listPostsByUsername) actually
 *   shows — same visibility gating, incl. private-account hiding for non-followers.
 * - isFollowing: null for an anonymous viewer OR self (backend doesn't compute a
 *   self-follow); true/false for a logged-in non-self viewer.
 */
export async function getUserProfile(username: string, viewerId?: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      ...publicUserSelect,
      _count: { select: { followers: true, following: true } },
    },
  });

  if (!user) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }

  const isOwner = viewerId === user.id;

  // Single follow lookup, reused for both postsCount gating and the isFollowing field.
  let viewerFollows = false;
  if (viewerId && !isOwner) {
    viewerFollows = await isFollowing(viewerId, user.id);
  }

  // Same gating as listPostsByUsername: a private account hides its posts from
  // non-owner non-followers entirely → count 0; otherwise count by allowed visibility.
  const privateHidden = user.isPrivate && !isOwner && !viewerFollows;
  const allowedVisibility: PostVisibility[] = isOwner
    ? ['PUBLIC', 'FOLLOWERS', 'PRIVATE']
    : viewerFollows
      ? ['PUBLIC', 'FOLLOWERS']
      : ['PUBLIC'];

  const postsCount = privateHidden
    ? 0
    : await prisma.post.count({
        where: { authorId: user.id, visibility: { in: allowedVisibility } },
      });

  // Phase 4.4 — whether to show a story ring on the avatar. Same privacy gate as the
  // stories list (a private account hides its stories from non-follower non-owners).
  // findFirst (existence) is cheaper than a full count.
  const hasActiveStory = privateHidden
    ? false
    : !!(await prisma.story.findFirst({
        where: { authorId: user.id, isArchived: false, expiresAt: { gt: new Date() } },
        select: { id: true },
      }));

  const { _count, ...publicFields } = user;

  return {
    ...publicFields,
    postsCount,
    followersCount: _count.followers,
    followingCount: _count.following,
    isFollowing: !viewerId || isOwner ? null : viewerFollows,
    hasActiveStory,
  };
}

/** A public user row (the 7 publicUserSelect fields) — reused by the groupable list. */
type GroupablePublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

/**
 * Users the viewer can add to a new group (Phase 5.5, Q3). The pool = their recent conversation
 * partners (convenience) + mutual followers (privacy — both sides opted in). Recent first (by
 * conversation activity), then mutuals (alphabetical), deduped by id, self excluded. Optional
 * `q` does a case-insensitive partial match on username/name WITHIN that pool. Returns a capped,
 * non-paginated suggestion list.
 */
export async function getGroupableUsers(meId: string, { q, limit }: GroupableQueryInput) {
  // Recent partners — every OTHER participant of my conversations, most-recent activity first.
  const myParticipations = await prisma.participant.findMany({
    where: { userId: meId },
    orderBy: { conversation: { lastMessageAt: 'desc' } },
    select: {
      conversation: {
        select: {
          participants: {
            where: { userId: { not: meId } },
            select: { user: { select: publicUserSelect } },
          },
        },
      },
    },
  });

  // Mutual followers — I follow them AND they follow me (Follow self-join via two cheap lookups).
  const [iFollow, followsMe] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: meId }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: meId }, select: { followerId: true } }),
  ]);
  const iFollowSet = new Set(iFollow.map((f) => f.followingId));
  const mutualIds = followsMe.map((f) => f.followerId).filter((id) => iFollowSet.has(id));
  const mutualUsers = mutualIds.length
    ? await prisma.user.findMany({
        where: { id: { in: mutualIds } },
        select: publicUserSelect,
        orderBy: { name: 'asc' },
      })
    : [];

  // Merge: recent (in activity order) first, then mutuals not already seen. Dedupe by id.
  const seen = new Set<string>();
  const merged: (GroupablePublicUser & { source: 'recent' | 'mutual' })[] = [];
  for (const p of myParticipations) {
    for (const { user } of p.conversation.participants) {
      if (seen.has(user.id)) continue;
      seen.add(user.id);
      merged.push({ ...user, source: 'recent' });
    }
  }
  for (const user of mutualUsers) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    merged.push({ ...user, source: 'mutual' });
  }

  // Optional partial match within the pool (case-insensitive; username or display name).
  const needle = q?.toLowerCase();
  const filtered = needle
    ? merged.filter(
        (u) => u.username.toLowerCase().includes(needle) || u.name.toLowerCase().includes(needle),
      )
    : merged;

  return filtered.slice(0, limit);
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  // Loại bỏ các field undefined / empty string
  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.bio !== undefined) data.bio = input.bio;
  if (input.avatarUrl !== undefined) {
    data.avatarUrl = input.avatarUrl === '' ? null : input.avatarUrl;
  }
  if (input.isPrivate !== undefined) data.isPrivate = input.isPrivate;

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { ...publicUserSelect, email: true },
  });

  return user;
}
