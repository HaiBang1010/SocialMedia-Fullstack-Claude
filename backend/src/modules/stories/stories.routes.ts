import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { createStorySchema } from './stories.schema';
import { paginationSchema } from '../posts/posts.schema';
import * as storiesService from './stories.service';

const router = Router();

/**
 * POST /stories — create a story (a single image or video, 24h). Auth required.
 */
router.post(
  '/',
  requireAuth,
  validate(createStorySchema),
  asyncHandler(async (req, res) => {
    const story = await storiesService.createStory(req.user!.id, req.body);
    res.status(201).json(story);
  }),
);

/**
 * GET /stories/feed — active stories of followed users, grouped by author. Auth required.
 */
router.get(
  '/feed',
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await storiesService.getStoriesFeed(req.user!.id);
    res.json(result);
  }),
);

/**
 * GET /stories/archive — the current user's own archived (expired) stories. Auth required.
 * Declared before the /:id routes so "archive" is never captured as an id.
 */
router.get(
  '/archive',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await storiesService.listArchivedStories(req.user!.id, req.query as any);
    res.json(result);
  }),
);

/**
 * GET /stories/:id/views — list who viewed a story (owner only). Auth required.
 */
router.get(
  '/:id/views',
  requireAuth,
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await storiesService.listStoryViewers(
      req.params.id,
      req.user!.id,
      req.query as any,
    );
    res.json(result);
  }),
);

/**
 * POST /stories/:id/view — mark a story viewed (idempotent upsert). Auth required.
 */
router.post(
  '/:id/view',
  requireAuth,
  asyncHandler(async (req, res) => {
    await storiesService.markStoryViewed(req.params.id, req.user!.id);
    res.status(204).send();
  }),
);

/**
 * DELETE /stories/:id — delete own story + S3 cleanup (owner only). Auth required.
 */
router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    await storiesService.deleteStory(req.params.id, req.user!.id);
    res.status(204).send();
  }),
);

export default router;
