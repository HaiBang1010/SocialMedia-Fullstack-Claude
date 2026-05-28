import { apiClient } from './client';
import type { UserResponse } from '@/types/api';

export interface UpdateProfileInput {
  name?: string;
  bio?: string;
  avatarUrl?: string;
  isPrivate?: boolean;
}

export const usersApi = {
  getByUsername: async (username: string): Promise<UserResponse> => {
    const { data } = await apiClient.get<UserResponse>(`/users/${username}`);
    return data;
  },

  updateMe: async (input: UpdateProfileInput): Promise<UserResponse> => {
    const { data } = await apiClient.patch<UserResponse>('/users/me', input);
    return data;
  },
};
