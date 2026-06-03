import { apiClient } from './client';
import type { FeedResponse, PaginationParams } from '@/types/api';

export const feedApi = {
  // GET /feed → personalized feed (following users, 14-day window),
  // cursor-paginated. Auth required.
  get: async (params?: PaginationParams): Promise<FeedResponse> => {
    const { data } = await apiClient.get<FeedResponse>('/feed', { params });
    return data;
  },
};
