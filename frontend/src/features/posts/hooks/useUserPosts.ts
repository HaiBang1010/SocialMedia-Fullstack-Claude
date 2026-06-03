import { useInfiniteQuery } from '@tanstack/react-query';
import { postsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Infinite list of a user's posts (GET /users/:username/posts), cursor-paginated.
export function useUserPosts(username: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.userPosts(username),
    queryFn: ({ pageParam }) =>
      postsApi.listByUsername(username, { cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(username),
  });
}
