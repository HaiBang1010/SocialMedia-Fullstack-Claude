import { useInfiniteQuery } from '@tanstack/react-query';
import { storiesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// The current user's archived (expired) stories, cursor-paginated (GET /stories/archive).
// Used by ArchivePage (grid) and the StoryViewer's archive mode (queue =
// pages.flatMap(p => p.stories)). `enabled` lets the viewer fetch only in archive mode.
export function useArchivedStories(enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.archivedStories(),
    queryFn: ({ pageParam }) => storiesApi.listArchive(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}
