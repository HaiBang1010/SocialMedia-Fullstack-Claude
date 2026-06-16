import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { markAllNotificationsReadInCache } from '@/lib/notificationCache';

// Mark every notification read (PATCH /notifications/read-all). Clears the cached list's isRead
// flags + zeroes the unread-count badge on success.
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      markAllNotificationsReadInCache(qc);
      qc.setQueryData(queryKeys.notificationsUnreadCount(), { count: 0 });
    },
  });
}
