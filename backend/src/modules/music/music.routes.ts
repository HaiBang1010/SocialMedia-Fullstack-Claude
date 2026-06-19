import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { searchMusicQuerySchema } from './music.schema';
import * as musicService from './music.service';

const router = Router();

// GET /music/search?q=&limit= — proxied iTunes track search (auth-only). No trending endpoint
// (iTunes Search API has none) → BACKLOG.
router.get(
  '/search',
  requireAuth,
  validate(searchMusicQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await musicService.searchTracks(req.query as any);
    res.json(result);
  }),
);

export default router;
