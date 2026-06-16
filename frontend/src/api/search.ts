import { apiClient } from './client';
import type { SearchResponse, SearchType } from '@/types/api';

export const searchApi = {
  // GET /search?q=&type=&limit=&offset= → { posts, users } ranked by relevance.
  search: async (
    q: string,
    type: SearchType = 'all',
    params?: { limit?: number; offset?: number },
  ): Promise<SearchResponse> => {
    const { data } = await apiClient.get<SearchResponse>('/search', {
      params: { q, type, ...params },
    });
    return data;
  },
};
