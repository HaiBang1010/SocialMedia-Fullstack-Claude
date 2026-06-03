import { apiClient } from './client';
import type {
  Comment,
  CommentListResponse,
  CreateCommentInput,
  PaginationParams,
  UpdateCommentInput,
} from '@/types/api';

export const commentsApi = {
  // GET /posts/:id/comments → oldest-first, cursor-paginated.
  list: async (
    postId: string,
    params?: PaginationParams
  ): Promise<CommentListResponse> => {
    const { data } = await apiClient.get<CommentListResponse>(
      `/posts/${postId}/comments`,
      { params }
    );
    return data;
  },

  // POST /posts/:id/comments → 201, bare Comment.
  create: async (
    postId: string,
    input: CreateCommentInput
  ): Promise<Comment> => {
    const { data } = await apiClient.post<Comment>(
      `/posts/${postId}/comments`,
      input
    );
    return data;
  },

  // PATCH /comments/:id → bare Comment (author only).
  update: async (id: string, input: UpdateCommentInput): Promise<Comment> => {
    const { data } = await apiClient.patch<Comment>(`/comments/${id}`, input);
    return data;
  },

  // DELETE /comments/:id → 204 (comment author or post author).
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/comments/${id}`);
  },
};
