import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';
import Spinner from '@/components/common/Spinner';
import StoryProgressBars from './StoryProgressBars';
import { useStoryViewerStore } from '@/stores/storyViewerStore';
import { useAuthStore } from '@/stores/authStore';
import { useStoriesFeed } from '@/features/stories/hooks/useStoriesFeed';
import { useUserStories } from '@/features/stories/hooks/useUserStories';
import { useViewStory } from '@/features/stories/hooks/useViewStory';
import { useDeleteStory } from '@/features/stories/hooks/useDeleteStory';
import { useStoryGestures } from '@/hooks/useStoryGestures';
import { formatRelativeTime } from '@/lib/format';

// Full-screen story viewer — a single instance mounted in AppLayout, driven by
// storyViewerStore. Hand-rolled fixed overlay (not Radix Dialog) so gestures
// don't fight a focus trap; we lock body scroll + handle ESC here.
//
// Hybrid data source (Phase 4.2):
//   • FEED mode — opened from a ring in StoryBar. Reads the grouped stories feed
//     (each item already carries that author's full stories[]), so advancing
//     across users is instant with no per-user fetch.
//   • SINGLE-USER mode — the start user isn't in the feed (the feed excludes self,
//     so this covers "View story" after posting). Falls back to GET
//     /users/:username/stories. No cross-user advance — closes at the end.
//
// Phase 4.2 also adds timed progress bars + hold-to-pause / swipe-to-dismiss /
// tap-nav gestures.
export default function StoryViewer() {
  const isOpen = useStoryViewerStore((s) => s.isOpen);
  const startUsername = useStoryViewerStore((s) => s.startUsername);
  const close = useStoryViewerStore((s) => s.close);
  const me = useAuthStore((s) => s.user);

  const { data: feedItems, isLoading: feedLoading } = useStoriesFeed();
  const { view } = useViewStory();
  const { remove } = useDeleteStory();

  // -1 = not yet initialized (FEED mode sets the real index). Single-user mode
  // leaves it at -1 and reads stories from useUserStories instead.
  const [currentUserIndex, setCurrentUserIndex] = useState(-1);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isUnseenFlow, setIsUnseenFlow] = useState(false);
  const [muted, setMuted] = useState(false);
  const initializedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const feedUser = currentUserIndex >= 0 ? feedItems?.[currentUserIndex] : undefined;

  // Single-user fallback: only when the start user isn't in the loaded feed.
  const startInFeed = !!feedItems?.some((it) => it.user.username === startUsername);
  const singleEnabled = isOpen && !!startUsername && feedItems !== undefined && !startInFeed;
  const { data: singleStories, isLoading: singleLoading } = useUserStories(
    startUsername,
    singleEnabled,
  );

  const stories = feedUser ? feedUser.stories : singleEnabled ? singleStories : undefined;
  const currentStory = stories?.[currentStoryIndex];
  const isLoading = feedLoading || (singleEnabled && singleLoading);

  // Advance: next story → else (FEED + unseen flow) the next user with unseen
  // stories → else close. Forward-only + gated on isUnseenFlow matches IG: tapping
  // an already-seen ring (or viewing your own) shows just that set, then closes.
  // The feed's hasUnseenStory flags flip as we view (optimistic cache) WITHOUT
  // reordering, so the "next unseen" search stays correct and indices stay stable.
  const goNext = useCallback(() => {
    if (!stories) return;
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex((i) => i + 1);
      return;
    }
    if (isUnseenFlow && feedItems && currentUserIndex >= 0) {
      const next = feedItems.findIndex(
        (it, idx) => idx > currentUserIndex && it.hasUnseenStory,
      );
      if (next !== -1) {
        setCurrentUserIndex(next);
        setCurrentStoryIndex(0);
        return;
      }
    }
    close();
  }, [stories, currentStoryIndex, isUnseenFlow, feedItems, currentUserIndex, close]);

  const goPrev = useCallback(() => {
    setCurrentStoryIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const gestures = useStoryGestures({
    onPrev: goPrev,
    onNext: goNext,
    onPause: () => undefined, // pause state is read off gestures.isPaused
    onResume: () => undefined,
    onDismiss: close,
  });

  // Initialize once per open: pick the data source + jump to the first unseen
  // story. Guarded by initializedRef so the optimistic view-mark mutating the
  // caches doesn't reset our position mid-viewing. Resets when the viewer closes.
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      setCurrentUserIndex((i) => (i === -1 ? i : -1));
      return;
    }
    if (initializedRef.current) return;
    if (feedItems === undefined) return; // wait for the feed query to resolve

    const uIdx = feedItems.findIndex((it) => it.user.username === startUsername);
    if (uIdx !== -1) {
      // FEED mode — cross-user enabled.
      const firstUnseen = feedItems[uIdx].stories.findIndex((s) => !s.isViewedByMe);
      setCurrentUserIndex(uIdx);
      setCurrentStoryIndex(firstUnseen === -1 ? 0 : firstUnseen);
      setIsUnseenFlow(feedItems[uIdx].hasUnseenStory);
      initializedRef.current = true;
      return;
    }
    // SINGLE-USER mode — wait for the user's stories, then start (no cross-user).
    if (singleStories === undefined) return;
    if (singleStories.length === 0) {
      close();
      return;
    }
    const firstUnseen = singleStories.findIndex((s) => !s.isViewedByMe);
    setCurrentUserIndex(-1);
    setCurrentStoryIndex(firstUnseen === -1 ? 0 : firstUnseen);
    setIsUnseenFlow(false);
    initializedRef.current = true;
  }, [isOpen, feedItems, singleStories, startUsername, close]);

  // Body scroll lock + ESC while open.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  // Mark the current story seen (idempotent). Skipped for already-seen stories so
  // it doesn't re-fire after the optimistic cache flip. The author's username
  // tells the cache which userStories list to patch (works in both modes).
  useEffect(() => {
    if (isOpen && currentStory && !currentStory.isViewedByMe) {
      view({ storyId: currentStory.id, username: currentStory.author.username });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentStory?.id]);

  // Video playback: pause on hold, otherwise play (with sound first — opening the
  // viewer was a user gesture — then fall back to muted autoplay if blocked).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.mediaType !== 'VIDEO') return;
    if (gestures.isPaused) {
      v.pause();
      return;
    }
    v.play().catch(() => {
      setMuted(true);
      v.muted = true;
      v.play().catch(() => undefined);
    });
  }, [currentStory?.id, currentStory?.mediaType, gestures.isPaused]);

  // React only sets the `muted` attribute on mount, not on updates — sync the DOM
  // property so the toggle (and a freshly mounted video) honor the preference.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted, currentStory?.id]);

  if (!isOpen) return null;

  const isOwner = !!me && !!currentStory && me.id === currentStory.authorId;

  const handleDelete = () => {
    if (!currentStory || !stories) return;
    const count = stories.length;
    remove({ storyId: currentStory.id, username: currentStory.author.username });
    if (count <= 1) {
      close();
    } else if (currentStoryIndex >= count - 1) {
      // Deleting the last story: step back so we land on the new last item.
      setCurrentStoryIndex(count - 2);
    }
    // Otherwise the next story shifts into the current index as the cache shrinks.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute top-4 right-4 z-40 grid size-9 place-items-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
      >
        <X className="size-5" />
      </button>

      <div
        className={cn(
          'relative h-full w-full max-w-md overflow-hidden bg-neutral-900',
          !gestures.isDragging && 'transition-transform duration-200',
        )}
        style={{
          transform: `translateY(${gestures.translateY}px)`,
          opacity: 1 - Math.min(gestures.translateY / 400, 0.6),
        }}
      >
        {isLoading || !currentStory || !stories ? (
          <div className="grid size-full place-items-center">
            <Spinner />
          </div>
        ) : (
          <>
            {currentStory.mediaType === 'VIDEO' ? (
              <video
                key={currentStory.id}
                ref={videoRef}
                src={currentStory.mediaUrl}
                poster={currentStory.thumbnailUrl ?? undefined}
                muted={muted}
                playsInline
                onEnded={goNext}
                className="absolute inset-0 size-full object-contain"
              />
            ) : (
              <img
                src={currentStory.mediaUrl}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
            )}

            <StoryProgressBars
              stories={stories}
              currentIndex={currentStoryIndex}
              isPaused={gestures.isPaused}
              onComplete={goNext}
            />

            {/* Header */}
            <div className="absolute inset-x-3 top-5 z-30 flex items-center gap-2 text-white">
              <Link
                to={`/users/${currentStory.author.username}`}
                onClick={close}
                className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-80"
              >
                <Avatar user={currentStory.author} size="sm" className="ring-2 ring-white/70" />
                <span className="text-sm font-medium">{currentStory.author.username}</span>
              </Link>
              <span className="text-xs text-white/70">
                {formatRelativeTime(currentStory.createdAt)}
              </span>
              {isOwner && (
                <button
                  type="button"
                  aria-label="Delete story"
                  onClick={handleDelete}
                  className="ml-auto grid size-8 place-items-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/55"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>

            {/* Mute toggle (video only). */}
            {currentStory.mediaType === 'VIDEO' && (
              <button
                type="button"
                aria-label={muted ? 'Unmute' : 'Mute'}
                onClick={() => setMuted((m) => !m)}
                className="absolute right-3 bottom-3 z-30 grid size-9 place-items-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
              >
                {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
            )}

            {/* Gesture layer: hold-pause / swipe-down / tap-nav. Sits above the
                media but below the header, mute, and close buttons (higher z,
                siblings) so tapping those never reaches it. touch-none keeps
                mobile scroll/pull-refresh from stealing the gesture. */}
            <div className="absolute inset-0 z-10 touch-none" {...gestures.handlers} />
          </>
        )}
      </div>
    </div>
  );
}
