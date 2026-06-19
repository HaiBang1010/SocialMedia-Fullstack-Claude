import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useStoriesFeed } from "@/features/stories/hooks/useStoriesFeed";
import { useStoryComposerStore } from "@/stores/storyComposerStore";
import { useStoryViewerStore } from "@/stores/storyViewerStore";
import Avatar from "@/components/common/Avatar";
import StoryRingItem from "./StoryRingItem";

// IG-style story rail at the top of the feed. "Your story" opens the composer;
// each following user's ring opens the viewer. Wired to GET /stories/feed (Phase
// 4.1) — replaces the static placeholder that lived in FeedPage.
export default function StoryBar() {
  const me = useAuthStore((s) => s.user);
  const { data: items, isLoading } = useStoriesFeed();
  const openComposer = useStoryComposerStore((s) => s.open);
  const openViewer = useStoryViewerStore((s) => s.open);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Recompute which arrows are usable from the current scroll position.
  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    // -1 tolerance for sub-pixel rounding at the end of the track.
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  // Re-check on mount and whenever the story set changes (data load).
  useEffect(() => {
    updateArrows();
  }, [items]);

  // Measure a real item at runtime so a click lands on whole-item boundaries
  // (responsive-safe — no hardcoded pixel step that drifts when widths change).
  const scroll = (dir: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) return;

    const firstItem = container.querySelector("[data-story-item]") as HTMLElement | null;
    if (!firstItem) return;

    const itemWidth = firstItem.offsetWidth;
    const gap = parseFloat(getComputedStyle(container).gap) || 0;
    const step = (itemWidth + gap) * 3; // scroll 3 items per click

    container.scrollBy({
      left: dir === "left" ? -step : step,
      behavior: "smooth",
    });
  };

  const arrowBase =
    "absolute top-1/2 z-10 hidden size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background shadow-md transition-opacity duration-200 md:flex";

  return (
    <div className="group relative border-b pb-4">
      <button
        type="button"
        aria-label="Scroll stories left"
        onClick={() => scroll("left")}
        className={cn(
          arrowBase,
          "left-2",
          canScrollLeft
            ? "opacity-0 group-hover:opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll stories right"
        onClick={() => scroll("right")}
        className={cn(
          arrowBase,
          "right-2",
          canScrollRight
            ? "opacity-0 group-hover:opacity-100"
            : "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight className="size-5" />
      </button>

      <div
        ref={scrollRef}
        onScroll={updateArrows}
        className="scrollbar-hide flex gap-6.5 overflow-x-auto"
      >
        {/* Your story — opens the composer. */}
        <button
          type="button"
          data-story-item
          onClick={openComposer}
          className="flex shrink-0 flex-col items-center justify-around gap-1.5"
        >
          <span className="relative inline-flex rounded-full p-[2px] bg-muted">
            {me ? (
              <Avatar user={me} size="lg" className="size-16 ring-2 ring-border" />
            ) : (
              <span className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50 text-muted-foreground">
                <Plus className="size-6" />
              </span>
            )}
            <span className="absolute right-0 bottom-0 grid size-5 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground">
              <Plus className="size-3" />
            </span>
          </span>
          <span className="max-w-16 truncate text-xs text-muted-foreground">
            Your story
          </span>
        </button>

        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                data-story-item
                className="flex shrink-0 flex-col items-center gap-1.5"
              >
                <span className="size-16 animate-pulse rounded-full bg-muted" />
                <span className="h-2 w-10 animate-pulse rounded bg-muted" />
              </div>
            ))
          : items?.map((item) => (
              <StoryRingItem
                key={item.user.id}
                user={item.user}
                hasUnseen={item.hasUnseenStory}
                onClick={() => openViewer({ mode: 'feed', startUsername: item.user.username })}
              />
            ))}
      </div>
    </div>
  );
}
