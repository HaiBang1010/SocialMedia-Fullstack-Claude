import { apiClient } from './client';
import type { LikeResponse } from '@/types/api';

export const likesApi = {
  // POST /posts/:id/like → { liked, likesCount }. Idempotent.
  like: async (postId: string): Promise<LikeResponse> => {
    const { data } = await apiClient.post<LikeResponse>(`/posts/${postId}/like`);
    return data;
  },

  // DELETE /posts/:id/like → { liked, likesCount }. Idempotent (returns a body).
  unlike: async (postId: string): Promise<LikeResponse> => {
    const { data } = await apiClient.delete<LikeResponse>(
      `/posts/${postId}/like`
    );
    return data;
  },
};
