import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/authStore';
import type { RefreshResponse } from '@/types/api';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const apiClient = axios.create({ baseURL });

// Mark requests we've already retried after a refresh, to avoid loops.
interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

// Request interceptor: attach the current access token.
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single in-flight refresh shared by all concurrent 401s.
let refreshPromise: Promise<string> | null = null;

async function runRefresh(refreshToken: string): Promise<string> {
  // Bare axios (not apiClient) so this call skips the interceptors.
  const { data } = await axios.post<RefreshResponse>(
    `${baseURL}/auth/refresh`,
    { refreshToken }
  );
  useAuthStore.getState().setTokens({ accessToken: data.accessToken });
  return data.accessToken;
}

// Response interceptor: on 401, try one refresh + retry. FIX 1: never
// redirect from here — just clear the store. ProtectedRoute reacts to
// !isAuthenticated and redirects to /login on its own.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;

    // Backend gộp chung error message (BACKLOG P2) → quyết định theo HTTP
    // status, không parse message.
    const isAuthError = error.response?.status === 401;
    const isRefreshCall = original?.url?.includes('/auth/refresh');

    if (!isAuthError || !original || original._retry || isRefreshCall) {
      return Promise.reject(error);
    }

    const refreshToken = useAuthStore.getState().refreshToken;
    if (!refreshToken) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      refreshPromise = refreshPromise ?? runRefresh(refreshToken);
      const newToken = await refreshPromise;
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original as AxiosRequestConfig);
    } catch (refreshError) {
      // Refresh failed (expired / wrong type / invalid) → force logout.
      useAuthStore.getState().logout();
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  }
);
