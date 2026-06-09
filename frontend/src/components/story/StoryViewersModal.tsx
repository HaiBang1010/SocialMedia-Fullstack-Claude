import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Avatar from '@/components/common/Avatar';
import Spinner from '@/components/common/Spinner';
import { useStoryViewers } from '@/features/stories/hooks/useStoryViewers';
import { useStoryViewerStore } from '@/stores/storyViewerStore';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { formatRelativeTime } from '@/lib/format';

interface StoryViewersModalProps {
  storyId: string | null;
  open: boolean;
  onClose: () => void;
}

// Owner-only list of who viewed a story (Phase 4.4). Radix Dialog → portals above the
// StoryViewer overlay; the viewer pauses while this is open. Fetches only when open.
export default function StoryViewersModal({ storyId, open, onClose }: StoryViewersModalProps) {
  const closeViewer = useStoryViewerStore((s) => s.close);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useStoryViewers(
    storyId,
    open,
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  useInfiniteScroll(sentinelRef, {
    onIntersect: fetchNextPage,
    enabled: open && !!hasNextPage && !isFetchingNextPage,
  });

  const viewers = data?.pages.flatMap((p) => p.viewers) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogTitle className="border-b px-4 py-3">Viewers</DialogTitle>
        <div className="max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <div className="grid place-items-center py-10">
              <Spinner />
            </div>
          ) : viewers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No viewers yet</p>
          ) : (
            <>
              <ul className="divide-y">
                {viewers.map((v) => (
                  <li key={v.user.id}>
                    <Link
                      to={`/users/${v.user.username}`}
                      onClick={() => {
                        onClose(); // close the modal
                        closeViewer(); // and the story viewer behind it
                      }}
                      className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
                    >
                      <Avatar user={v.user} size="md" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{v.user.username}</span>
                        <span className="truncate text-xs text-muted-foreground">{v.user.name}</span>
                      </div>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(v.viewedAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div ref={sentinelRef} />
              {isFetchingNextPage && (
                <div className="grid place-items-center py-4">
                  <Spinner />
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
