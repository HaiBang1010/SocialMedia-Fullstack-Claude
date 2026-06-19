import { apiClient } from './client';
import type { MusicSearchResponse } from '@/types/api';

export const musicApi = {
  // GET /music/search?q=&limit= → tracks for a Music Story (iTunes Search proxy).
  search: async (q: string, limit?: number): Promise<MusicSearchResponse> => {
    const { data } = await apiClient.get<MusicSearchResponse>('/music/search', {
      params: limit ? { q, limit } : { q },
    });
    return data;
  },
};
