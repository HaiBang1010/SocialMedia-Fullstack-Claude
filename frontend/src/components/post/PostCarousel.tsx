import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import type { PostMedia as PostMediaItem } from '@/types/api';
import { clampAspectRatio } from '@/lib/format';
import { cn } from '@/lib/utils';
import PostMedia from './PostMedia';

interface PostCarouselProps {
  media: PostMediaItem[];
  alt?: string;
  className?: string;
}

// Renders a post's media. A single image (the entire Phase 2 corpus) defers to
// PostMedia unchanged — no carousel chrome, no behavioural change. Multiple
// images become a hand-rolled CSS scroll-snap carousel: native swipe on touch,
// prev/next arrows on desktop, dot indicators, and a stacked-squares badge.
// All slides share one aspect ratio (the composer enforces a shared ratio), so
// the container height is fixed from the first item and slides never jump.
export default function PostCarousel({ media, alt, className }: PostCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Hooks run unconditionally; the single-image path returns afterwards.
  if (media.length <= 1) {
    return <PostMedia media={media} alt={alt} className={className} />;
  }

  const ratio = clampAspectRatio(media[0].width, media[0].height);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  const goTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const clamped = Math.min(Math.max(idx, 0), media.length - 1);
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className={cn('relative w-full overflow-hidden bg-muted', className)}>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className={cn(
          'scrollbar-hide flex w-full snap-x snap-mandatory overflow-x-auto',
          ratio == null && 'aspect-square',
        )}
        style={ratio != null ? { aspectRatio: ratio } : undefined}
      >
        {media.map((m, i) => (
          <div key={m.id} className="size-full shrink-0 basis-full snap-center">
            <img
              src={m.url}
              alt={i === 0 ? (alt ?? '') : ''}
              loading={i === 0 ? 'eager' : 'lazy'}
              className="size-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* Multi-image badge */}
      <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/55 text-white">
        <Copy className="size-3.5" />
      </span>

      {/* Desktop prev/next */}
      {active > 0 && (
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => goTo(active - 1)}
          className="absolute top-1/2 left-2 hidden -translate-y-1/2 place-items-center rounded-full bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60 md:grid"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {active < media.length - 1 && (
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => goTo(active + 1)}
          className="absolute top-1/2 right-2 hidden -translate-y-1/2 place-items-center rounded-full bg-black/40 p-1.5 text-white transition-colors hover:bg-black/60 md:grid"
        >
          <ChevronRight className="size-4" />
        </button>
      )}

      {/* Position dots */}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {media.map((m, i) => (
          <span
            key={m.id}
            className={cn(
              'size-1.5 rounded-full transition-colors',
              i === active ? 'bg-white' : 'bg-white/50',
            )}
          />
        ))}
      </div>
    </div>
  );
}
