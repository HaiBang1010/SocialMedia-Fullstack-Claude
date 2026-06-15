import { apiClient } from './client';
import type { ProfileResponse, UserResponse, GroupableUser } from '@/types/api';

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  isPrivate?: boolean;
}

export const usersApi = {
  // GET /users/:username → public profile DTO (counts + isFollowing).
  getByUsername: async (username: string): Promise<ProfileResponse> => {
    const { data } = await apiClient.get<ProfileResponse>(`/users/${username}`);
    return data;
  },

  updateMe: async (input: UpdateProfileInput): Promise<UserResponse> => {
    const { data } = await apiClient.patch<UserResponse>('/users/me', input);
    return data;
  },

  // GET /users/groupable → users the viewer can add to a new group (Phase 5.5). Bare array,
  // search-driven (no cursor). `q` partial-matches username/name; `limit` caps the result.
  getGroupable: async (q?: string, limit?: number): Promise<GroupableUser[]> => {
    const { data } = await apiClient.get<GroupableUser[]>('/users/groupable', {
      params: { q: q || undefined, limit },
    });
    return data;
  },
};
