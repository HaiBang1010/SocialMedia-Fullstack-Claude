import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { publicUserSelect } from '../users/users.service';
import { safeNotify } from '../notifications/notifications.service';
import type { PaginationInput } from '../posts/posts.schema';

/** Resolve a username to its id + privacy flag, or 404 if it does not exist. */
async function resolveUser(username: string): Promise<{ id: string; isPrivate: boolean }> {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isPrivate: true },
  });
  if (!user) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }
  return user;
}

/**
 * Follow a user. Idempotent (upsert) — following again is a no-op success.
 * Phase 2.3b: instant approve, no follow-request flow even for private accounts
 * (see BACKLOG P2 for the approval flow planned in a later phase).
 */
export async function followUser(followerId: string, targetUsername: string) {
  const { id: followingId } = await resolveUser(targetUsername);
  if (followingId === followerId) {
    throw new AppError(400, 'CannotFollowSelf', 'You cannot follow yourself');
  }

  // Phase 7: create+catch-P2002 (instead of upsert) detects the true 0→1 follow so a re-follow
  // never re-notifies; the HTTP contract ({ following: true }) is unchanged either way.
  let isNew = false;
  try {
    await prisma.follow.create({ data: { followerId, followingId } });
    isNew = true;
  } catch (err) {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    // already following → idempotent success, no notification
  }

  if (isNew) {
    await safeNotify(followingId, { type: 'FOLLOW', actorId: followerId });
  }

  return { following: true };
}

/** Unfollow a user. Idempotent — unfollowing someone you don't follow still returns 200. */
export async function unfollowUser(followerId: string, targetUsername: string) {
  const { id: followingId } = await resolveUser(targetUsername);
  await prisma.follow.deleteMany({ where: { followerId, followingId } });
  return { following: false };
}

/**
 * Whether `viewerId` may see `user`'s follower/following lists.
 * Public account: anyone. Private account: only the owner or an account that follows it.
 */
async function canViewSocialList(
  user: { id: string; isPrivate: boolean },
  viewerId: string | undefined,
): Promise<boolean> {
  if (!user.isPrivate || viewerId === user.id) {
    return true;
  }
  return viewerId ? isFollowing(viewerId, user.id) : false;
}

/**
 * People who follow `username` (rows where the user is the `following` target).
 * Cursor = the follower's id (the variable side; `followingId` is fixed to this user).
 * Private account → empty list for non-owner non-followers (incl. anonymous).
 */
export async function listFollowers(
  username: string,
  viewerId: string | undefined,
  pagination: PaginationInput,
) {
  const user = await resolveUser(username);
  if (!(await canViewSocialList(user, viewerId))) {
    return { users: [], nextCursor: null };
  }

  const { cursor, limit } = pagination;

  const rows = await prisma.follow.findMany({
    where: { followingId: user.id },
    include: { follower: { select: publicUserSelect } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor
      ? { cursor: { followerId_followingId: { followerId: cursor, followingId: user.id } }, skip: 1 }
      : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.followerId : null;

  return { users: slice.map((r) => r.follower), nextCursor };
}

/**
 * People `username` is following (rows where the user is the `follower`).
 * Cursor = the followed user's id (the variable side; `followerId` is fixed to this user).
 * Private account → empty list for non-owner non-followers (incl. anonymous).
 */
export async function listFollowing(
  username: string,
  viewerId: string | undefined,
  pagination: PaginationInput,
) {
  const user = await resolveUser(username);
  if (!(await canViewSocialList(user, viewerId))) {
    return { users: [], nextCursor: null };
  }

  const { cursor, limit } = pagination;

  const rows = await prisma.follow.findMany({
    where: { followerId: user.id },
    include: { following: { select: publicUserSelect } },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor
      ? { cursor: { followerId_followingId: { followerId: user.id, followingId: cursor } }, skip: 1 }
      : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.followingId : null;

  return { users: slice.map((r) => r.following), nextCursor };
}

/** Whether `viewerId` follows `authorId`. Reused by posts/feed visibility checks (Phiên 2). */
export async function isFollowing(viewerId: string, authorId: string): Promise<boolean> {
  const row = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: authorId } },
    select: { followerId: true },
  });
  return row !== null;
}
