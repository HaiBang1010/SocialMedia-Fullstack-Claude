import { apiClient } from './client';
import type {
  AuthResponse,
  RefreshResponse,
  UserResponse,
} from '@/types/api';

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  name: string;
}

export const authApi = {
  register: async (input: RegisterInput): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', input);
    return data;
  },

  // Backend login field is "identifier" (email or username).
  login: async (identifier: string, password: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', {
      identifier,
      password,
    });
    return data;
  },

  refresh: async (refreshToken: string): Promise<RefreshResponse> => {
    const { data } = await apiClient.post<RefreshResponse>('/auth/refresh', {
      refreshToken,
    });
    return data;
  },

  me: async (): Promise<UserResponse> => {
    const { data } = await apiClient.get<UserResponse>('/auth/me');
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
