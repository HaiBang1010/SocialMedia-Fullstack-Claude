import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getViewablePost } from '../posts/posts.service';
import { safeNotify } from '../notifications/notifications.service';

/**
 * Like a post. Idempotent — liking again is a no-op success (still returns { liked: true }).
 * Gated by visibility: liking a post you cannot see returns 404 (existence hidden).
 * Phase 7: `create`+catch-P2002 (instead of upsert) so we can detect the true 0→1 like and only
 * then notify the author — re-liking never re-spams the notification.
 */
export async function likePost(userId: string, postId: string) {
  const post = await getViewablePost(postId, userId);

  let isNew = false;
  try {
    await prisma.like.create({ data: { userId, postId } });
    isNew = true;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    // already liked → idempotent success, no notification
  }

  const likesCount = await prisma.like.count({ where: { postId } });
  if (isNew) {
    await safeNotify(post.authorId, { type: 'LIKE', actorId: userId, postId });
  }
  return { liked: true, likesCount };
}

/**
 * Unlike a post. Idempotent — unliking something you don't like still returns 200.
 * Not visibility-gated: retracting your own like must always be allowed
 * (e.g. the post turned private after you liked it).
 */
export async function unlikePost(userId: string, postId: string) {
  await prisma.like.deleteMany({ where: { userId, postId } });
  const likesCount = await prisma.like.count({ where: { postId } });
  return { liked: false, likesCount };
}
