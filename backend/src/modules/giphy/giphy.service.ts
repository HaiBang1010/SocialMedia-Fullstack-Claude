import { env } from '../../config/env';
import { AppError } from '../../middleware/error';
import type { GiphySearchInput, GiphyTrendingInput, GiphyType } from './giphy.schema';

// Phase 5.4c — Giphy proxy service. Uses Node 20's global fetch (no HTTP-client dependency added).
const GIPHY_BASE = 'https://api.giphy.com/v1';
const GIPHY_TIMEOUT_MS = 8000;

// Our `type` maps to Giphy's endpoint family: stickers under /stickers, GIFs under /gifs.
function endpointFamily(type: GiphyType): 'gifs' | 'stickers' {
  return type === 'stickers' ? 'stickers' : 'gifs';
}

interface GiphyRaw {
  id: string;
  images?: {
    fixed_width?: { url?: string; width?: string; height?: string };
    fixed_width_still?: { url?: string };
  };
}

// Trim the (large) Giphy payload to our minimal shape; drop items missing the animated render.
function transform(raw: GiphyRaw[]) {
  const items = [];
  for (const g of raw) {
    const fw = g.images?.fixed_width;
    if (!fw?.url) continue;
    items.push({
      id: g.id,
      url: fw.url,
      previewUrl: g.images?.fixed_width_still?.url ?? fw.url,
      width: Number.parseInt(fw.width ?? '', 10) || 0,
      height: Number.parseInt(fw.height ?? '', 10) || 0,
    });
  }
  return { items };
}

async function callGiphy(path: string, params: Record<string, string>) {
  const url = new URL(`${GIPHY_BASE}${path}`);
  url.searchParams.set('api_key', env.GIPHY_API_KEY);
  url.searchParams.set('rating', 'g'); // keep results SFW
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(GIPHY_TIMEOUT_MS) });
  } catch {
    // Network error / timeout — surface as 503 (client shows a friendly "try again").
    throw new AppError(503, 'GiphyUnavailable', 'Giphy is temporarily unavailable');
  }
  if (!res.ok) {
    // 429 (rate limit) / 5xx from Giphy → 503 to our client.
    throw new AppError(503, 'GiphyUnavailable', 'Giphy is temporarily unavailable');
  }
  const body = (await res.json()) as { data?: GiphyRaw[] };
  return transform(body.data ?? []);
}

export async function searchGiphy(input: GiphySearchInput) {
  return callGiphy(`/${endpointFamily(input.type)}/search`, {
    q: input.q,
    limit: String(input.limit),
  });
}

export async function trendingGiphy(input: GiphyTrendingInput) {
  return callGiphy(`/${endpointFamily(input.type)}/trending`, {
    limit: String(input.limit),
  });
}
