import { Router } from 'express';
import { optionalAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { searchQuerySchema } from './search.schema';
import * as searchService from './search.service';

const router = Router();

/**
 * GET /search — full-text search over posts + users. optionalAuth: anonymous searchers see only
 * PUBLIC posts; a logged-in viewer also sees their own + FOLLOWERS-where-following posts.
 */
router.get(
  '/',
  optionalAuth,
  validate(searchQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await searchService.search(req.query as any, req.user?.id);
    res.json(result);
  }),
);

export default router;
