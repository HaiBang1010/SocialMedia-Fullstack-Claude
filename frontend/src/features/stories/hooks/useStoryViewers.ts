import { useInfiniteQuery } from '@tanstack/react-query';
import { storiesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Who viewed a story (GET /stories/:id/views), cursor-paginated. Owner-only on the
// backend; `enabled` gates the fetch to (isOwner && modal open) so we never 403.
export function useStoryViewers(storyId: string | null, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: queryKeys.storyViewers(storyId ?? ''),
    queryFn: ({ pageParam }) => storiesApi.listViewers(storyId!, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: enabled && Boolean(storyId),
  });
}
