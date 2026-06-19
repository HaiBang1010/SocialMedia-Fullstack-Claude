import { AppError } from '../../middleware/error';
import type { SearchMusicInput, MusicTrack } from './music.schema';

// Music Story — iTunes Search API proxy. Uses Node 20's global fetch (no HTTP-client dep, mirrors
// giphy.service). No api_key: iTunes Search is public/unauthenticated.
const ITUNES_BASE = 'https://itunes.apple.com';
const ITUNES_TIMEOUT_MS = 8000;
const ITUNES_COUNTRY = 'US'; // storefront — US has the broadest catalog + preview coverage

interface ITunesRaw {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artworkUrl100?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
}

// Trim the iTunes payload to our minimal shape; drop rows missing a preview (defensive — iTunes
// returns ~100% previews, but never trust upstream) and upscale the 100x100 artwork to 512x512.
function transform(raw: ITunesRaw[]): { items: MusicTrack[] } {
  const items: MusicTrack[] = [];
  for (const t of raw) {
    if (!t.previewUrl || t.trackId == null || !t.artworkUrl100) continue;
    items.push({
      id: String(t.trackId),
      title: t.trackName ?? '',
      artist: t.artistName ?? '',
      albumArt: t.artworkUrl100.replace('100x100', '512x512'),
      previewUrl: t.previewUrl,
      durationMs: t.trackTimeMillis ?? 0,
    });
  }
  return { items };
}

export async function searchTracks(input: SearchMusicInput) {
  const url = new URL(`${ITUNES_BASE}/search`);
  url.searchParams.set('term', input.q);
  url.searchParams.set('media', 'music');
  url.searchParams.set('entity', 'song');
  url.searchParams.set('country', ITUNES_COUNTRY);
  url.searchParams.set('limit', String(input.limit));

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(ITUNES_TIMEOUT_MS) });
  } catch {
    // Network error / timeout — surface as 503 (client shows a friendly "try again").
    throw new AppError(503, 'MusicUnavailable', 'Music search is temporarily unavailable');
  }
  if (!res.ok) {
    // 429 (rate limit) / 5xx from iTunes → 503 to our client.
    throw new AppError(503, 'MusicUnavailable', 'Music search is temporarily unavailable');
  }
  const body = (await res.json()) as { results?: ITunesRaw[] };
  return transform(body.results ?? []);
}
