import { PostVisibility } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { isFollowing } from '../follows/follows.service';
import type { UpdateProfileInput } from './users.schema';

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
