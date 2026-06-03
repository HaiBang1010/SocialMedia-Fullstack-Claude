import { apiClient } from './client';
import type {
  CreatePostInput,
  PaginationParams,
  Post,
  PostListResponse,
  UpdatePostInput,
} from '@/types/api';

export const postsApi = {
  // POST /posts → 201, bare Post.
  create: async (input: CreatePostInput): Promise<Post> => {
    const { data } = await apiClient.post<Post>('/posts', input);
    return data;
  },

  // GET /posts/:id → bare Post. Private/followers + non-owner resolves to 404.
  getById: async (id: string): Promise<Post> => {
    const { data } = await apiClient.get<Post>(`/posts/${id}`);
    return data;
  },

  // PATCH /posts/:id → bare Post (owner only).
  update: async (id: string, input: UpdatePostInput): Promise<Post> => {
    const { data } = await apiClient.patch<Post>(`/posts/${id}`, input);
    return data;
  },

  // DELETE /posts/:id → 204 (owner only).
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/posts/${id}`);
  },

  // GET /users/:username/posts → cursor-paginated list.
  listByUsername: async (
    username: string,
    params?: PaginationParams
  ): Promise<PostListResponse> => {
    const { data } = await apiClient.get<PostListResponse>(
      `/users/${username}/posts`,
      { params }
    );
    return data;
  },
};
