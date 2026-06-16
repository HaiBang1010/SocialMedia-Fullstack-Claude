import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Total unread messages across all conversations (GET /conversations/unread-total) — the Messages
// nav badge. Kept live by the global socket handler (increment on message:new, reset on read).
export function useUnreadTotal() {
  return useQuery({
    queryKey: queryKeys.conversationsUnreadTotal(),
    queryFn: () => conversationsApi.unreadTotal(),
    select: (d) => d.total,
    staleTime: 30_000,
  });
}
