import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import type { PostMedia as PostMediaItem } from '@/types/api';
import { clampAspectRatio, formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';

interface PostVideoProps {
  media: PostMediaItem[];
  alt?: string; // unused (video has no alt) — kept for signature parity
  className?: string;
}

// Renders a post's video (single-media-only). Autoplays muted when ≥50% scrolled
// into view and pauses when it leaves (one observer per instance — feed videos
// play independently, no single-active coordinator). Letterboxed (object-contain)
// so vertical clips are never cropped. Tapping the video toggles mute; it is NOT
// wrapped in a Link so the gesture never navigates.
export default function PostVideo({ media, className }: PostVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const item = media[0];
  const ratio = clampAspectRatio(item?.width ?? null, item?.height ?? null);

  // Play/pause based on viewport intersection.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) el.play().catch(() => undefined);
        else el.pause();
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // React only sets the `muted` attribute on mount, not on updates — sync the DOM
  // property so the toggle actually works.
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  if (!item) return null;

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden bg-black',
        ratio == null && 'aspect-square',
        className,
      )}
      style={ratio != null ? { aspectRatio: ratio } : undefined}
    >
      <video
        ref={videoRef}
        src={item.url}
        poster={item.thumbnailUrl ?? undefined}
        muted
        loop
        playsInline
        preload="metadata"
        onClick={() => setMuted((m) => !m)}
        className="size-full cursor-pointer object-contain"
      />

      {/* Mute toggle */}
      <button
        type="button"
        aria-label={muted ? 'Unmute' : 'Mute'}
        onClick={() => setMuted((m) => !m)}
        className="absolute right-2 bottom-2 grid size-8 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/70"
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>

      {/* Duration overlay */}
      {item.duration != null && (
        <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
          {formatDuration(item.duration)}
        </span>
      )}
    </div>
  );
}
