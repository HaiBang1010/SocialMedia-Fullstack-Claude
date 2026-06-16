// Phase 7 — direct cache patches for realtime notifications (mirror conversationCache).
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Notification, NotificationListResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Insert a realtime notification at the top of the list cache, de-duped by id — a 1h-bumped
 * notification keeps a single row, moved back to the top. No-op when the list isn't cached.
 */
export function prependNotification(qc: QueryClient, n: Notification): void {
  qc.setQueryData<InfiniteData<NotificationListResponse>>(queryKeys.notifications(), (data) => {
    if (!data || data.pages.length === 0) return data;
    const pages = data.pages.map((page) => ({
      ...page,
      notifications: page.notifications.filter((x) => x.id !== n.id),
    }));
    const [first, ...rest] = pages;
    return { ...data, pages: [{ ...first, notifications: [n, ...first.notifications] }, ...rest] };
  });
}

/** Mark every cached notification as read (after PATCH /notifications/read-all succeeds). */
export function markAllNotificationsReadInCache(qc: QueryClient): void {
  qc.setQueryData<InfiniteData<NotificationListResponse>>(queryKeys.notifications(), (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        notifications: page.notifications.map((n) => (n.isRead ? n : { ...n, isRead: true })),
      })),
    };
  });
}
