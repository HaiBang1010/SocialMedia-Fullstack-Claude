import { useEffect, useRef } from 'react';
import { Heart } from 'lucide-react';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useMarkAllRead } from '@/features/notifications/hooks/useMarkAllRead';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import EmptyState from '@/components/common/EmptyState';
import NotificationItem from '@/components/notifications/NotificationItem';

// Full-page notifications (route /notifications). Opening the page marks everything read (clears
// the nav badge). New notifications still arrive live via the global socket handler.
export default function NotificationsPage() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useNotifications();
  const { mutate: markAllRead } = useMarkAllRead();
  const sentinel = useRef<HTMLDivElement>(null);

  // react-query's mutate is stable → runs once on mount.
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  useInfiniteScroll(sentinel, {
    onIntersect: () => fetchNextPage(),
    enabled: !!hasNextPage && !isFetchingNextPage,
  });

  const notifications = data?.pages.flatMap((p) => p.notifications) ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-4 py-4 backdrop-blur">
        <h1 className="font-heading text-xl font-bold">Notifications</h1>
      </header>

      {isLoading ? (
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-2 w-16 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No notifications yet"
          description="When people like, comment on your posts, or follow you, you'll see it here."
        />
      ) : (
        <ul>
          {notifications.map((n) => (
            <li key={n.id}>
              <NotificationItem notification={n} />
            </li>
          ))}
          <div ref={sentinel} className="h-8" />
        </ul>
      )}
    </div>
  );
}
