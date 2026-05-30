import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Static placeholders — the real feed/stories arrive in Phase 2 (no fetch yet).
const STORIES = [
  "mayac",
  "leop",
  "avar",
  "noahk",
  "sarad",
  "theoq",
  "emmaw",
  "liamb",
  "olivs",
  "noahf",
  "miac",
];

interface PlaceholderPost {
  username: string;
  location: string;
  likes: number;
  caption: string;
  age: string;
  gradient: string;
}

const POSTS: PlaceholderPost[] = [
  {
    username: "mayac",
    location: "Lisbon, Portugal",
    likes: 1243,
    caption: "Golden hour never misses.",
    age: "2 hours ago",
    gradient: "from-primary/70 to-[oklch(0.7_0.17_80)]",
  },
  {
    username: "leop",
    location: "Kyoto, Japan",
    likes: 892,
    caption: "Quiet streets, loud memories.",
    age: "5 hours ago",
    gradient: "from-[oklch(0.55_0.18_295)] to-[oklch(0.65_0.15_180)]",
  },
  {
    username: "avar",
    location: "Reykjavík, Iceland",
    likes: 2310,
    caption: "Chasing the lights.",
    age: "1 day ago",
    gradient: "from-[oklch(0.5_0.12_230)] to-primary/60",
  },
];

function StoryBar() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Recompute which arrows are usable from the current scroll position.
  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    // -1 tolerance for sub-pixel rounding at the end of the track.
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  // Initialise on mount — handles the "fits without scrolling" case (both hidden).
  useEffect(() => {
    updateArrows();
  }, []);

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
      {/* Arrows: desktop-only, fade in on hover, hidden when that direction is exhausted. */}
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

      {/* gap-8 fits exactly 6 stories within the max-w-xl feed width. */}
      <div
        ref={scrollRef}
        onScroll={updateArrows}
        className="scrollbar-hide flex gap-6.5 overflow-x-auto"
      >
        {/* Your story */}
        <button
          type="button"
          data-story-item
          disabled
          aria-disabled="true"
          className="flex shrink-0 cursor-not-allowed flex-col items-center gap-1.5 opacity-80"
        >
          <span className="flex size-17 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/50 text-muted-foreground">
            <Plus className="size-6" />
          </span>
          <span className="max-w-16 truncate text-xs text-muted-foreground">
            Your story
          </span>
        </button>

        {STORIES.map((username) => (
          <div
            key={username}
            data-story-item
            className="flex shrink-0 flex-col items-center gap-1.5"
          >
            <span className="rounded-full bg-gradient-to-tr from-primary to-[oklch(0.7_0.17_80)] p-[2px]">
              <span className="flex size-16 items-center justify-center rounded-full bg-background text-xs font-medium text-muted-foreground">
                {username.slice(0, 2).toUpperCase()}
              </span>
            </span>
            <span className="max-w-16 truncate text-xs">{username}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: PlaceholderPost }) {
  return (
    <article className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center gap-3 px-4 py-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {post.username.slice(0, 2).toUpperCase()}
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold">@{post.username}</div>
          <div className="text-xs text-muted-foreground">{post.location}</div>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          aria-label="More options"
          className="cursor-not-allowed text-muted-foreground opacity-60"
        >
          <MoreHorizontal />
        </button>
      </header>

      {/* Image placeholder (no S3 fetch in Phase 1). */}
      <div className={`aspect-square w-full bg-gradient-to-br ${post.gradient}`} />

      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-4 text-foreground">
          <Heart className="size-6" />
          <MessageCircle className="size-6" />
          <Send className="size-6" />
        </div>
        <Bookmark className="size-6" />
      </div>

      <div className="space-y-1 px-4 pb-4 text-sm">
        <div className="font-semibold">{post.likes.toLocaleString()} likes</div>
        <div>
          <span className="font-semibold">@{post.username}</span>{" "}
          <span>{post.caption}</span>
        </div>
        <div className="text-xs text-muted-foreground">{post.age}</div>
      </div>
    </article>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <StoryBar />
      <div className="mt-6 flex flex-col gap-6">
        {POSTS.map((post) => (
          <PostCard key={post.username} post={post} />
        ))}
      </div>
    </div>
  );
}
