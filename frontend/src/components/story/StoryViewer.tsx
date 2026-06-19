import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Trash2, Volume1, Volume2, VolumeX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';
import Spinner from '@/components/common/Spinner';
import StoryProgressBars from './StoryProgressBars';
import StoryOverlayLayer from './StoryOverlayLayer';
import StoryViewersModal from './StoryViewersModal';
import { useStoryViewerStore } from '@/stores/storyViewerStore';
import { useAuthStore } from '@/stores/authStore';
import { useStoriesFeed } from '@/features/stories/hooks/useStoriesFeed';
import { useUserStories } from '@/features/stories/hooks/useUserStories';
import { useArchivedStories } from '@/features/stories/hooks/useArchivedStories';
import { useViewStory } from '@/features/stories/hooks/useViewStory';
import { useDeleteStory } from '@/features/stories/hooks/useDeleteStory';
import { useStoryGestures } from '@/hooks/useStoryGestures';
import { formatRelativeTime } from '@/lib/format';
import type { StoryItem } from '@/types/api';

const STORY_MUTED_KEY = 'beng-story-muted';
const STORY_VOLUME_KEY = 'beng-story-volume';

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
  const mode = useStoryViewerStore((s) => s.mode);
  const startUsername = useStoryViewerStore((s) => s.startUsername);
  const startStoryId = useStoryViewerStore((s) => s.startStoryId);
  const close = useStoryViewerStore((s) => s.close);
  const me = useAuthStore((s) => s.user);

  // One data source per mode, each enabled only for its mode (feed is the shared
  // StoryBar cache, always on). See storyViewerStore for the mode semantics.
  const { data: feedItems, isLoading: feedLoading } = useStoriesFeed();
  const { data: singleStories, isLoading: singleLoading } = useUserStories(
    startUsername,
    isOpen && mode === 'single-user',
  );
  const {
    data: archiveData,
    isLoading: archiveLoading,
    hasNextPage: archiveHasNextPage,
    fetchNextPage: archiveFetchNextPage,
  } = useArchivedStories(isOpen && mode === 'archive');
  const { view } = useViewStory();
  const { remove } = useDeleteStory();

  // -1 = not a cross-user feed flow (single-user / archive leave it at -1).
  const [currentUserIndex, setCurrentUserIndex] = useState(-1);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [isUnseenFlow, setIsUnseenFlow] = useState(false);
  // Default muted (autoplay-safe + IG behavior: tap to unmute). Persisted so the choice
  // sticks across stories/sessions; applies to both video and music stories.
  const [muted, setMuted] = useState(() => {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(STORY_MUTED_KEY) !== 'false';
  });
  // Playback volume 0-1 (separate from muted, HTML5-audio native). Persisted; default 0.5.
  const [volume, setVolume] = useState(() => {
    if (typeof localStorage === 'undefined') return 0.5;
    const v = Number.parseFloat(localStorage.getItem(STORY_VOLUME_KEY) ?? '');
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
  });
  const [isViewersModalOpen, setIsViewersModalOpen] = useState(false);
  const initializedRef = useRef(false);
  const modalOpenRef = useRef(false);
  modalOpenRef.current = isViewersModalOpen;
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(STORY_MUTED_KEY, String(next));
      } catch {
        /* private mode / quota — non-fatal */
      }
      return next;
    });
  }, []);

  // Slider drag → set + persist volume. Dragging up while muted auto-unmutes so the change
  // is audible; dragging to 0 leaves the mute state alone (still silent either way).
  const changeVolume = useCallback((v: number) => {
    const next = Math.min(1, Math.max(0, v));
    setVolume(next);
    try {
      localStorage.setItem(STORY_VOLUME_KEY, String(next));
    } catch {
      /* non-fatal */
    }
    if (next > 0) {
      setMuted((m) => {
        if (!m) return m;
        try {
          localStorage.setItem(STORY_MUTED_KEY, 'false');
        } catch {
          /* non-fatal */
        }
        return false;
      });
    }
  }, []);

  // Archive queue = all loaded pages flattened (newest-first).
  const archivedStories = useMemo(
    () => archiveData?.pages.flatMap((p) => p.stories),
    [archiveData],
  );
  const feedUser = currentUserIndex >= 0 ? feedItems?.[currentUserIndex] : undefined;

  const stories =
    mode === 'feed'
      ? feedUser?.stories
      : mode === 'single-user'
        ? singleStories
        : archivedStories;
  const currentStory = stories?.[currentStoryIndex];
  const isLoading =
    mode === 'feed' ? feedLoading : mode === 'single-user' ? singleLoading : archiveLoading;

  // Music Story overlay (image story + a MUSIC item). Drives the <audio> element + mute UI.
  const musicItem = useMemo(
    () =>
      currentStory?.items?.find(
        (it): it is Extract<StoryItem, { type: 'MUSIC' }> => it.type === 'MUSIC',
      ),
    [currentStory],
  );

  // Cross-user advance is FEED-only; single-user / archive view one user's set and close.
  const canCrossUserAdvance = mode === 'feed' && isUnseenFlow;
  const shouldMarkSeen = mode !== 'archive'; // archived stories are already seen

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
    if (canCrossUserAdvance && feedItems && currentUserIndex >= 0) {
      const next = feedItems.findIndex(
        (it, idx) => idx > currentUserIndex && it.hasUnseenStory,
      );
      if (next !== -1) {
        setCurrentUserIndex(next);
        setCurrentStoryIndex(0);
        return;
      }
    }
    // Archive: at the end of the loaded set, pull the next page and step into it
    // (brief spinner until it resolves); otherwise close.
    if (mode === 'archive' && archiveHasNextPage) {
      archiveFetchNextPage();
      setCurrentStoryIndex((i) => i + 1);
      return;
    }
    close();
  }, [
    stories,
    currentStoryIndex,
    canCrossUserAdvance,
    feedItems,
    currentUserIndex,
    mode,
    archiveHasNextPage,
    archiveFetchNextPage,
    close,
  ]);

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

  // Pause for either a hold gesture OR the viewers modal being open. Drives the
  // progress bars + video playback so the timeline freezes while the list is up.
  const isPaused = gestures.isPaused || isViewersModalOpen;

  // Initialize once per open: pick the start index for the active mode. Guarded by
  // initializedRef so the optimistic view-mark mutating the caches doesn't reset our
  // position mid-viewing. Resets when the viewer closes.
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      setCurrentUserIndex((i) => (i === -1 ? i : -1));
      setIsViewersModalOpen(false);
      return;
    }
    if (initializedRef.current) return;

    if (mode === 'feed') {
      if (feedItems === undefined) return; // wait for the feed query to resolve
      const uIdx = feedItems.findIndex((it) => it.user.username === startUsername);
      if (uIdx === -1) {
        close(); // start user is no longer in the feed
        return;
      }
      const firstUnseen = feedItems[uIdx].stories.findIndex((s) => !s.isViewedByMe);
      setCurrentUserIndex(uIdx);
      setCurrentStoryIndex(firstUnseen === -1 ? 0 : firstUnseen);
      setIsUnseenFlow(feedItems[uIdx].hasUnseenStory);
      initializedRef.current = true;
      return;
    }

    if (mode === 'single-user') {
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
      return;
    }

    // ARCHIVE mode — start at the clicked story (startStoryId), no cross-user, no unseen.
    if (archivedStories === undefined) return;
    if (archivedStories.length === 0) {
      close();
      return;
    }
    const idx = startStoryId ? archivedStories.findIndex((s) => s.id === startStoryId) : 0;
    setCurrentUserIndex(-1);
    setCurrentStoryIndex(idx === -1 ? 0 : idx);
    setIsUnseenFlow(false);
    initializedRef.current = true;
  }, [isOpen, mode, feedItems, singleStories, archivedStories, startUsername, startStoryId, close]);

  // Body scroll lock + ESC while open.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      // When the viewers modal is open, ESC closes the modal (Radix) — not the viewer.
      if (e.key === 'Escape' && !modalOpenRef.current) close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, close]);

  // Mark the current story seen (idempotent). Skipped in archive mode (already seen,
  // and the backend rejects views on archived stories) and for already-seen stories.
  useEffect(() => {
    if (isOpen && shouldMarkSeen && currentStory && !currentStory.isViewedByMe) {
      view({ storyId: currentStory.id, username: currentStory.author.username });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentStory?.id]);

  // Video playback: pause on hold, otherwise play (with sound first — opening the
  // viewer was a user gesture — then fall back to muted autoplay if blocked).
  // `isOpen` is in the deps so reopening the SAME story re-fires this: the viewer
  // doesn't unmount (it renders null while closed) so currentStory.id is unchanged
  // on reopen, but the <video> element DID remount and needs play() called again.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.mediaType !== 'VIDEO') return;
    if (isPaused) {
      v.pause();
      return;
    }
    v.play().catch(() => {
      setMuted(true);
      v.muted = true;
      v.play().catch(() => undefined);
    });
  }, [isOpen, currentStory?.id, currentStory?.mediaType, isPaused]);

  // React only sets the `muted` attribute on mount, not on updates — sync the DOM
  // muted + volume properties so the toggle/slider (and a freshly mounted element) honor them.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
      videoRef.current.volume = volume;
    }
    if (audioRef.current) {
      audioRef.current.muted = muted;
      audioRef.current.volume = volume;
    }
  }, [muted, volume, currentStory?.id]);

  // Music Story audio — start each clip at startMs when the story changes (not on
  // pause/resume, so a hold-to-pause resumes in place like the progress bar + video).
  useEffect(() => {
    const a = audioRef.current;
    if (a && musicItem) a.currentTime = musicItem.payload.startMs / 1000;
  }, [isOpen, currentStory?.id, musicItem]);

  // Play/pause the clip in lock-step with the progress bar (paused on hold / viewers modal).
  // Mirrors the video effect; autoplay-block is silent (muted-by-default plays regardless).
  useEffect(() => {
    const a = audioRef.current;
    if (!a || !musicItem) return;
    if (isPaused) {
      a.pause();
      return;
    }
    a.play().catch(() => undefined);
  }, [isOpen, currentStory?.id, isPaused, musicItem]);

  if (!isOpen) return null;

  // Archive is always the viewer's own stories → owner. Otherwise compare author id.
  const isOwner = mode === 'archive' || (!!me && !!currentStory && me.id === currentStory.authorId);

  // Volume icon cascade: muted/0 → X, low → 1 wave, normal → 2 waves.
  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

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
          'relative mx-auto flex h-full w-full max-w-md flex-col bg-black',
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
            {/* TOP chrome — progress bars + header (h-20, mirrored by the editor so an
                overlay's normalized position lands on the same image content here). */}
            <div className="relative z-30 h-20 shrink-0">
              <StoryProgressBars
                stories={stories}
                currentIndex={currentStoryIndex}
                isPaused={isPaused}
                onComplete={goNext}
              />
              <div className="absolute inset-x-3 top-8 flex items-center gap-2 text-white">
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
            </div>

            {/* CONTENT — media + overlays + gesture layer. */}
            <div className="relative flex-1 overflow-hidden">
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

              {/* Music Story audio (invisible). Keyed per story → clean remount; the effects
                  above start it at startMs + play/pause with the timeline. */}
              {musicItem && (
                <audio
                  key={currentStory.id}
                  ref={audioRef}
                  src={musicItem.payload.previewUrl}
                  onTimeUpdate={(e) => {
                    const a = e.currentTarget;
                    if (
                      a.currentTime * 1000 >=
                      musicItem.payload.startMs + musicItem.payload.clipMs
                    ) {
                      a.pause();
                    }
                  }}
                />
              )}

              {/* Overlays (read-only). pointer-events-none → taps fall through to gestures.
                  Empty / absent items render nothing (4.1/4.2 stories). */}
              <StoryOverlayLayer items={currentStory.items} />

              {/* View count (owner only). Tap → viewers list. Left of the mute toggle. */}
              {isOwner && currentStory.viewCount !== null && (
                <button
                  type="button"
                  onClick={() => setIsViewersModalOpen(true)}
                  className="absolute bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-sm text-white transition-colors hover:bg-black/60"
                >
                  <Eye className="size-4" />
                  <span className="tabular-nums">{currentStory.viewCount}</span>
                  <span className="text-white/80">
                    {currentStory.viewCount === 1 ? 'view' : 'views'}
                  </span>
                </button>
              )}

              {/* Volume control (video OR music story). Icon = tap-to-mute (both desktop +
                  mobile). Desktop (hover-capable, fine pointer) also reveals a vertical slider
                  on hover; on touch the slider is hidden (device volume buttons handle it). */}
              {(currentStory.mediaType === 'VIDEO' || musicItem) && (
                <div className="group absolute right-3 bottom-3 z-30 flex flex-col items-center pt-2">
                  {/* Vertical slider popover — desktop hover only. No margin gap: the wrapper's
                      pt-2 is a transparent, HOVERABLE bridge between icon and slider so moving
                      the cursor up keeps group-hover (slider sits flush at the wrapper top). */}
                  <div className="pointer-events-none absolute bottom-full hidden flex-col items-center rounded-full bg-black/55 px-2 py-3 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:flex">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={muted ? 0 : volume}
                      onChange={(e) => changeVolume(Number(e.target.value))}
                      aria-label="Volume"
                      className="h-24 cursor-pointer accent-primary [direction:rtl] [writing-mode:vertical-lr]"
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={muted ? 'Unmute' : 'Mute'}
                    onClick={toggleMuted}
                    className="grid size-9 place-items-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60"
                  >
                    <VolumeIcon className="size-5" />
                  </button>
                </div>
              )}

              {/* Gesture layer: hold-pause / swipe-down / tap-nav. Above media + overlays
                  (z-10) but below mute (z-30); the header lives in the separate top-chrome
                  flex child so its buttons stay reachable. touch-none stops mobile scroll
                  from stealing the gesture. */}
              <div className="absolute inset-0 z-10 touch-none" {...gestures.handlers} />
            </div>

            {/* BOTTOM chrome — reply-input placeholder (h-20, mirrored by the editor).
                Music Story → a "now playing" pill. */}
            <div className="flex h-20 shrink-0 items-center justify-center px-4">
              {musicItem && (
                <div className="flex max-w-[80%] items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-white">
                  <img
                    src={musicItem.payload.albumArt}
                    alt=""
                    className="size-6 shrink-0 rounded object-cover"
                  />
                  <span className="truncate text-xs">
                    {musicItem.payload.title} · {musicItem.payload.artist}
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Viewers list (owner only). Radix Dialog → portals above this overlay. */}
      <StoryViewersModal
        storyId={currentStory?.id ?? null}
        open={isViewersModalOpen}
        onClose={() => setIsViewersModalOpen(false)}
      />
    </div>
  );
}
