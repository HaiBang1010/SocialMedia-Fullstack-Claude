import { useInfiniteQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// A conversation's messages (GET /conversations/:id/messages), cursor-paginated newest-first.
// Polls every 5s as the Phase 5.1 stand-in for realtime (Phase 5.2 swaps this for Socket.io).
// TanStack v5 pauses the interval while the tab is backgrounded (refetchIntervalInBackground
// defaults to false) and refetches on focus — so inactive tabs don't keep polling.
export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId ?? ''),
    queryFn: ({ pageParam }) =>
      conversationsApi.listMessages(conversationId!, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!conversationId,
    refetchInterval: 5000,
  });
}
