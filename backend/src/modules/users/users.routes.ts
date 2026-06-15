import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler';
import { validate } from '../../middleware/validate';
import { requireAuth, optionalAuth } from '../../middleware/auth';
import { updateProfileSchema, groupableQuerySchema } from './users.schema';
import * as usersService from './users.service';
import { paginationSchema } from '../posts/posts.schema';
import * as postsService from '../posts/posts.service';
import * as followsService from '../follows/follows.service';
import * as storiesService from '../stories/stories.service';

const router = Router();

/**
 * PATCH /users/me
 * Header: Authorization: Bearer <accessToken>
 * Body: { name?, bio?, avatarUrl?, isPrivate? }
 */
router.patch(
  '/me',
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const user = await usersService.updateProfile(req.user!.id, req.body);
    res.json({ user });
  })
);

/**
 * GET /users/groupable — users the viewer can add to a new group (recent conversation partners
 * + mutual followers). Declared BEFORE /:username so the literal isn't captured as a username.
 * `?q=` partial match, `?limit=` cap (default 20).
 */
router.get(
  '/groupable',
  requireAuth,
  validate(groupableQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const users = await usersService.getGroupableUsers(req.user!.id, req.query as any);
    res.json(users);
  })
);

/**
 * GET /users/:username
 * Public — xem profile của bất kỳ user nào. optionalAuth: viewer identity quyết
 * định `isFollowing` + visibility gating của postsCount.
 */
router.get(
  '/:username',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const user = await usersService.getUserProfile(req.params.username, req.user?.id);
    res.json({ user });
  })
);

/**
 * GET /users/:username/posts
 * List post của 1 user (cho ProfilePage). optionalAuth để áp visibility theo viewer.
 * Trả { posts, nextCursor } — cursor pagination.
 */
router.get(
  '/:username/posts',
  optionalAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await postsService.listPostsByUsername(
      req.params.username,
      req.user?.id,
      req.query as any,
    );
    res.json(result);
  })
);

/**
 * GET /users/:username/stories
 * Active stories of 1 user (oldest-first). optionalAuth → privacy gate (private
 * account + non-follower → empty) + per-story isViewedByMe for the viewer.
 */
router.get(
  '/:username/stories',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const result = await storiesService.listStoriesByUsername(
      req.params.username,
      req.user?.id,
    );
    res.json(result);
  })
);

/**
 * POST /users/:username/follow — follow a user (idempotent). Auth required.
 */
router.post(
  '/:username/follow',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await followsService.followUser(req.user!.id, req.params.username);
    res.json(result);
  })
);

/**
 * DELETE /users/:username/follow — unfollow a user (idempotent). Auth required.
 */
router.delete(
  '/:username/follow',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await followsService.unfollowUser(req.user!.id, req.params.username);
    res.json(result);
  })
);

/**
 * GET /users/:username/followers — people who follow this user. Cursor pagination.
 * optionalAuth: a private account's list is visible only to the owner + its followers.
 */
router.get(
  '/:username/followers',
  optionalAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await followsService.listFollowers(
      req.params.username,
      req.user?.id,
      req.query as any,
    );
    res.json(result);
  })
);

/**
 * GET /users/:username/following — who this user follows. Cursor pagination.
 * optionalAuth: a private account's list is visible only to the owner + its followers.
 */
router.get(
  '/:username/following',
  optionalAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await followsService.listFollowing(
      req.params.username,
      req.user?.id,
      req.query as any,
    );
    res.json(result);
  })
);

export default router;
