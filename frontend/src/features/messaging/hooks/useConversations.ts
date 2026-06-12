import { useInfiniteQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Infinite conversation list (GET /conversations), cursor-paginated, recent activity first.
export function useConversations() {
  return useInfiniteQuery({
    queryKey: queryKeys.conversations(),
    queryFn: ({ pageParam }) => conversationsApi.list({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
