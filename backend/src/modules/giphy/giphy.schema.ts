import { z } from 'zod';

// Phase 5.4c — Giphy proxy. The backend holds the API key and proxies search/trending so the key
// never reaches the client. `type` selects the Giphy endpoint family: animated GIFs or stickers.
export const GIPHY_TYPES = ['gif', 'stickers'] as const;

export const giphySearchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: z.enum(GIPHY_TYPES).default('gif'),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export const giphyTrendingSchema = z.object({
  type: z.enum(GIPHY_TYPES).default('gif'),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

// One result — only the fields the client needs to preview + send (no Giphy metadata leaks).
export const giphyItemSchema = z.object({
  id: z.string(),
  url: z.string().url(), // animated GIF/sticker (images.fixed_width)
  previewUrl: z.string().url(), // still frame (images.fixed_width_still)
  width: z.number().int(),
  height: z.number().int(),
});

export const giphyListResponseSchema = z.object({
  items: z.array(giphyItemSchema),
});

export type GiphySearchInput = z.infer<typeof giphySearchSchema>;
export type GiphyTrendingInput = z.infer<typeof giphyTrendingSchema>;
export type GiphyType = (typeof GIPHY_TYPES)[number];
