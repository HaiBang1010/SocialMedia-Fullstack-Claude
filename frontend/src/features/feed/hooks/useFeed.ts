import { useInfiniteQuery } from '@tanstack/react-query';
import { feedApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Infinite personalized feed (GET /feed), paginated by cursor.
// nextCursor === null → no more pages (getNextPageParam returns undefined).
export function useFeed() {
  return useInfiniteQuery({
    queryKey: queryKeys.feed(),
    queryFn: ({ pageParam }) => feedApi.get({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
