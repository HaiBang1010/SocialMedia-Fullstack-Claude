import { useRef } from 'react';
import { Archive, Play } from 'lucide-react';
import { useArchivedStories } from '@/features/stories/hooks/useArchivedStories';
import { useStoryViewerStore } from '@/stores/storyViewerStore';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { Skeleton } from '@/components/ui/skeleton';
import Spinner from '@/components/common/Spinner';
import EmptyState from '@/components/common/EmptyState';
import ErrorState from '@/components/common/ErrorState';
import type { Story } from '@/types/api';

// The current user's archived (expired) stories — a thumbnail grid. Tapping a cell
// opens the StoryViewer in archive mode at that story. Reached from the profile
// "Archive" button (/me/stories/archive). Phase 4.4.
export default function ArchivePage() {
  const openViewer = useStoryViewerStore((s) => s.open);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useArchivedStories();

  useInfiniteScroll(sentinelRef, {
    onIntersect: fetchNextPage,
    enabled: Boolean(hasNextPage) && !isFetchingNextPage,
  });

  const stories = data?.pages.flatMap((p) => p.stories) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-heading text-xl font-semibold">Archive</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Only you can see your archived stories.
      </p>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-md" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message="Couldn't load your archive." onRetry={() => refetch()} />
      ) : stories.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="No archived stories yet"
          description="Stories you've posted will appear here after they expire."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5">
            {stories.map((story) => (
              <ArchiveCell
                key={story.id}
                story={story}
                onOpen={() => openViewer({ mode: 'archive', startStoryId: story.id })}
              />
            ))}
          </div>
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ArchiveCell({ story, onOpen }: { story: Story; onOpen: () => void }) {
  // Image → its url; video → its poster. Never load the full video on the grid.
  const thumb = story.mediaType === 'VIDEO' ? story.thumbnailUrl : story.mediaUrl;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open archived story"
      className="relative block aspect-[9/16] overflow-hidden rounded-md bg-muted"
    >
      {thumb && <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />}
      {story.mediaType === 'VIDEO' && (
        <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/55 text-white drop-shadow">
          <Play className="size-3.5 fill-white" />
        </span>
      )}
    </button>
  );
}
