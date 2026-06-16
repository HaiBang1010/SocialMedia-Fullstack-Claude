import { apiClient } from './client';
import type {
  CountResponse,
  NotificationListResponse,
  PaginationParams,
} from '@/types/api';

export const notificationsApi = {
  // GET /notifications → cursor-paginated, newest-first.
  list: async (params?: PaginationParams): Promise<NotificationListResponse> => {
    const { data } = await apiClient.get<NotificationListResponse>('/notifications', { params });
    return data;
  },

  // GET /notifications/unread-count → { count }.
  unreadCount: async (): Promise<CountResponse> => {
    const { data } = await apiClient.get<CountResponse>('/notifications/unread-count');
    return data;
  },

  // PATCH /notifications/read-all → { count }.
  markAllRead: async (): Promise<{ count: number }> => {
    const { data } = await apiClient.patch<{ count: number }>('/notifications/read-all');
    return data;
  },

  // PATCH /notifications/:id/read → { ok }.
  markRead: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await apiClient.patch<{ ok: boolean }>(`/notifications/${id}/read`);
    return data;
  },
};
