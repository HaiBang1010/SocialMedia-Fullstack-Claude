import { z } from 'zod';

// Music Story — iTunes Search API proxy. iTunes needs NO api_key/auth (unlike Giphy), so the
// backend proxies purely to (a) trim the bulky upstream payload to what the client needs and
// (b) keep CORS off the client. Pivoted from Spotify (its /v1/search now 403s without the app
// owner holding Premium, and preview_url is deprecated for new apps); iTunes previews are
// native m4a/AAC (Safari/iOS-safe) with 100% preview coverage.
export const searchMusicQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// One track — only the fields the client needs to preview + build the sticker payload.
export const musicTrackSchema = z.object({
  id: z.string(), // iTunes trackId as string
  title: z.string(),
  artist: z.string(),
  albumArt: z.string().url(), // upscaled to 512x512
  previewUrl: z.string().url(), // 30s m4a/AAC preview (Apple CDN)
  durationMs: z.number().int(), // full track length (display only)
});

export const musicListResponseSchema = z.object({
  items: z.array(musicTrackSchema),
});

export type SearchMusicInput = z.infer<typeof searchMusicQuerySchema>;
export type MusicTrack = z.infer<typeof musicTrackSchema>;
