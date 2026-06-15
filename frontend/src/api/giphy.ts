import { apiClient } from './client';
import type { GiphyItem } from '@/types/api';

export type GiphyType = 'gif' | 'stickers';

interface GiphyListResponse {
  items: GiphyItem[];
}

// Phase 5.4c — backend Giphy proxy (the API key stays server-side). Both return { items }.
export const giphyApi = {
  // GET /giphy/search?q=&type=&limit=
  search: async (q: string, type: GiphyType, limit = 24): Promise<GiphyItem[]> => {
    const { data } = await apiClient.get<GiphyListResponse>('/giphy/search', {
      params: { q, type, limit },
    });
    return data.items;
  },

  // GET /giphy/trending?type=&limit=
  trending: async (type: GiphyType, limit = 24): Promise<GiphyItem[]> => {
    const { data } = await apiClient.get<GiphyListResponse>('/giphy/trending', {
      params: { type, limit },
    });
    return data.items;
  },
};
