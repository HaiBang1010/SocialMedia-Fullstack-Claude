import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Prisma, PostVisibility } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { s3Client } from '../../lib/s3';
import { env } from '../../config/env';
import { publicUserSelect } from '../users/users.service';
import { isFollowing } from '../follows/follows.service';
import type { CreatePostInput, UpdatePostInput, PaginationInput } from './posts.schema';

// include dùng chung cho mọi response trả 1 post.
// Function nhận viewerId để: (a) đếm likes/comments, (b) biết viewer đã like chưa.
// Export để Feed module reuse cùng 1 nguồn include.
export const postInclude = (viewerId?: string) =>
  ({
    author: { select: publicUserSelect },
    media: { orderBy: { order: 'asc' } },
    _count: { select: { likes: true, comments: true } },
    ...(viewerId
      ? { likes: { where: { userId: viewerId }, take: 1, select: { userId: true } } }
      : {}),
  }) satisfies Prisma.PostInclude;

// Shape post đầy đủ field mà serializePost cần. `likes` optional vì postInclude
// bỏ nó khi không có viewerId (anonymous viewer).
type EnrichedPost = Prisma.PostGetPayload<{
  include: {
    author: { select: typeof publicUserSelect };
    media: { orderBy: { order: 'asc' } };
    _count: { select: { likes: true; comments: true } };
    likes: { select: { userId: true } };
  };
}>;
type SerializablePost = Omit<EnrichedPost, 'likes'> & { likes?: EnrichedPost['likes'] };

/**
 * Transform a Prisma post (fetched with postInclude) into the API DTO, adding the
 * 4 social fields: likesCount / commentsCount / isLikedByMe / isFollowingAuthor.
 * author/media giữ nguyên Date — res.json() serialize sang ISO ở HTTP layer (convention dự án).
 * Export để Feed module reuse.
 */
export function serializePost(post: SerializablePost, options: { isFollowingAuthor: boolean }) {
  return {
    id: post.id,
    authorId: post.authorId,
    caption: post.caption,
    visibility: post.visibility,
    createdAt: post.createdAt.toISOString(),
    author: post.author,
    media: post.media,
    likesCount: post._count.likes,
    commentsCount: post._count.comments,
    isLikedByMe: (post.likes?.length ?? 0) > 0,
    isFollowingAuthor: options.isFollowingAuthor,
  };
}

/**
 * Fetch a post enforcing READ visibility, or throw 404 (existence hidden — never 403 on read).
 * - PUBLIC: anyone
 * - FOLLOWERS: the owner, or a viewer who follows the author
 * - PRIVATE: owner only
 * Shared gate for getPostById, likes, and comments. Returns the enriched post
 * (postInclude) so getPostById can serialize it directly; like/comment callers
 * use it purely as a visibility gate and ignore the return value.
 */
export async function getViewablePost(postId: string, viewerId?: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: postInclude(viewerId),
  });

  if (!post) {
    throw new AppError(404, 'PostNotFound', 'Post not found');
  }

  const isOwner = viewerId === post.authorId;
  if (isOwner || post.visibility === 'PUBLIC') {
    return post;
  }
  if (post.visibility === 'FOLLOWERS' && viewerId && (await isFollowing(viewerId, post.authorId))) {
    return post;
  }

  // PRIVATE for a non-owner, or FOLLOWERS for a non-follower -> hide existence.
  throw new AppError(404, 'PostNotFound', 'Post not found');
}

/**
 * Tạo post + media (carousel: max 5 images) trong 1 lần create lồng nhau.
 * KHÔNG verify object S3 tồn tại — tin client đã upload (orphan check để Phase polish).
 */
export async function createPost(authorId: string, input: CreatePostInput) {
  const post = await prisma.post.create({
    data: {
      authorId,
      caption: input.caption?.trim() || null,
      visibility: input.visibility,
      media: {
        create: input.media.map((m, index) => ({
          type: m.type,
          url: m.url,
          objectKey: m.objectKey,
          width: m.width,
          height: m.height,
          order: index,
        })),
      },
    },
    include: postInclude(authorId),
  });

  // Author tạo post của chính mình → isFollowingAuthor = false; chưa ai like → counts = 0.
  return serializePost(post, { isFollowingAuthor: false });
}

/**
 * Lấy 1 post (enriched DTO). Visibility enforce qua getViewablePost:
 * PRIVATE/FOLLOWERS bởi non-owner non-follower → 404 (giấu existence, KHÔNG 403).
 */
export async function getPostById(postId: string, viewerId?: string) {
  const post = await getViewablePost(postId, viewerId);

  // isFollowingAuthor cho viewer (owner xem post của chính mình → false).
  let isFollowingAuthor = false;
  if (viewerId && viewerId !== post.authorId) {
    isFollowingAuthor = await isFollowing(viewerId, post.authorId);
  }

  return serializePost(post, { isFollowingAuthor });
}

/**
 * List post của 1 user (cho ProfilePage). Cursor pagination theo (createdAt desc, id desc).
 * Visibility honor follow-check thật:
 * - Owner: cả 3 (PUBLIC/FOLLOWERS/PRIVATE).
 * - Follower: PUBLIC + FOLLOWERS.
 * - Người ngoài (account public): chỉ PUBLIC.
 * - Account private + non-owner + non-follower → empty list (giấu nội dung).
 */
export async function listPostsByUsername(
  username: string,
  viewerId: string | undefined,
  pagination: PaginationInput,
): Promise<{ posts: unknown[]; nextCursor: string | null }> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isPrivate: true },
  });

  if (!user) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }

  const isOwner = viewerId === user.id;

  // Tính follow 1 LẦN (tránh N+1) — dùng cho cả gate private-account lẫn visibility filter.
  let viewerFollows = false;
  if (viewerId && !isOwner) {
    viewerFollows = await isFollowing(viewerId, user.id);
  }

  // Private account: chỉ owner + follower mới được xem danh sách post.
  if (user.isPrivate && !isOwner && !viewerFollows) {
    return { posts: [], nextCursor: null };
  }

  const allowedVisibility: PostVisibility[] = isOwner
    ? ['PUBLIC', 'FOLLOWERS', 'PRIVATE']
    : viewerFollows
      ? ['PUBLIC', 'FOLLOWERS']
      : ['PUBLIC'];

  const { cursor, limit } = pagination;

  const rows = await prisma.post.findMany({
    where: { authorId: user.id, visibility: { in: allowedVisibility } },
    include: postInclude(viewerId),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1, // lấy dư 1 để biết còn trang sau
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  // Mọi post cùng author → isFollowingAuthor là 1 giá trị (owner: false).
  const isFollowingAuthor = !isOwner && viewerFollows;

  return {
    posts: slice.map((p) => serializePost(p, { isFollowingAuthor })),
    nextCursor,
  };
}

/**
 * Cập nhật caption/visibility. Non-owner → 403 (viewer đã chứng minh biết post bằng cách edit).
 */
export async function updatePost(postId: string, userId: string, input: UpdatePostInput) {
  const post = await prisma.post.findUnique({ where: { id: postId } });

  if (!post) {
    throw new AppError(404, 'PostNotFound', 'Post not found');
  }
  if (post.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only edit your own posts');
  }

  const data: { caption?: string | null; visibility?: UpdatePostInput['visibility'] } = {};
  if (input.caption !== undefined) data.caption = input.caption.trim() || null;
  if (input.visibility !== undefined) data.visibility = input.visibility;

  const updated = await prisma.post.update({
    where: { id: postId },
    data,
    include: postInclude(userId),
  });

  // Chỉ owner mới tới được đây → isFollowingAuthor = false (không follow chính mình).
  return serializePost(updated, { isFollowingAuthor: false });
}

/**
 * Xóa post (cascade xóa PostMedia) + best-effort xóa object S3.
 * S3 delete fail → log, KHÔNG throw (DB delete đã commit).
 */
export async function deletePost(postId: string, userId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { media: { select: { objectKey: true } } },
  });

  if (!post) {
    throw new AppError(404, 'PostNotFound', 'Post not found');
  }
  if (post.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only delete your own posts');
  }

  // Cascade (onDelete: Cascade) tự xóa PostMedia rows.
  await prisma.post.delete({ where: { id: postId } });

  // Best-effort cleanup trên S3 — không chặn việc xóa DB nếu fail.
  for (const m of post.media) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: m.objectKey }),
      );
    } catch (err) {
      console.error(`[deletePost] Failed to delete S3 object ${m.objectKey}:`, err);
    }
  }
}
