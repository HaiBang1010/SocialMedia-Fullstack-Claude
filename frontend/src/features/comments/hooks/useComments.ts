import { useInfiniteQuery } from '@tanstack/react-query';
import { commentsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Infinite comment list (GET /posts/:id/comments), oldest-first.
// New pages append below the existing ones (IG-style chronological order).
export function useComments(postId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.comments(postId),
    queryFn: ({ pageParam }) => commentsApi.list(postId, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(postId),
  });
}
