import { useInfiniteQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// A conversation's messages (GET /conversations/:id/messages), cursor-paginated newest-first.
// Phase 5.2 — polling removed: incoming messages now arrive via the socket (message:new patches
// this cache through insertIncomingMessage), and a dropped socket refetches on reconnect.
export function useMessages(conversationId: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(conversationId ?? ''),
    queryFn: ({ pageParam }) =>
      conversationsApi.listMessages(conversationId!, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!conversationId,
  });
}
