import { apiClient } from './client';
import type {
  FollowResponse,
  PaginationParams,
  UserListResponse,
} from '@/types/api';

export const followsApi = {
  // POST /users/:username/follow → { following }. Idempotent.
  follow: async (username: string): Promise<FollowResponse> => {
    const { data } = await apiClient.post<FollowResponse>(
      `/users/${username}/follow`
    );
    return data;
  },

  // DELETE /users/:username/follow → { following }. Idempotent.
  unfollow: async (username: string): Promise<FollowResponse> => {
    const { data } = await apiClient.delete<FollowResponse>(
      `/users/${username}/follow`
    );
    return data;
  },

  // GET /users/:username/followers → cursor-paginated PublicUser list.
  listFollowers: async (
    username: string,
    params?: PaginationParams
  ): Promise<UserListResponse> => {
    const { data } = await apiClient.get<UserListResponse>(
      `/users/${username}/followers`,
      { params }
    );
    return data;
  },

  // GET /users/:username/following → cursor-paginated PublicUser list.
  listFollowing: async (
    username: string,
    params?: PaginationParams
  ): Promise<UserListResponse> => {
    const { data } = await apiClient.get<UserListResponse>(
      `/users/${username}/following`,
      { params }
    );
    return data;
  },
};
