import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../middleware/asyncHandler';
import { giphySearchSchema, giphyTrendingSchema } from './giphy.schema';
import * as giphyService from './giphy.service';

const router = Router();

// GET /giphy/search?q=&type=gif|stickers&limit= — proxied Giphy search (auth-only).
router.get(
  '/search',
  requireAuth,
  validate(giphySearchSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await giphyService.searchGiphy(req.query as any);
    res.json(result);
  }),
);

// GET /giphy/trending?type=gif|stickers&limit= — proxied Giphy trending (auth-only).
router.get(
  '/trending',
  requireAuth,
  validate(giphyTrendingSchema, 'query'),
  asyncHandler(async (req, res) => {
    const result = await giphyService.trendingGiphy(req.query as any);
    res.json(result);
  }),
);

export default router;
