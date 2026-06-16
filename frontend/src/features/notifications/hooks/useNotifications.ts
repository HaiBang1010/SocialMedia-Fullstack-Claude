import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Infinite notification list (GET /notifications), newest-first, cursor-paginated.
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: queryKeys.notifications(),
    queryFn: ({ pageParam }) => notificationsApi.list({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

// Unread notification count for the nav badge (GET /notifications/unread-count).
export function useNotificationsUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notificationsUnreadCount(),
    queryFn: () => notificationsApi.unreadCount(),
    select: (d) => d.count,
    staleTime: 30_000,
  });
}
