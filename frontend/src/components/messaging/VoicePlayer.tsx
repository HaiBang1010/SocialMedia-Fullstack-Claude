import { useMemo, useRef, useState } from 'react';
import { Loader2, Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDuration, generateWaveformBars } from '@/lib/audio';
import type { MessageMedia } from '@/types/api';

interface VoicePlayerProps {
  media: MessageMedia;
  isOwn: boolean;
}

// Voice-message bubble (Phase 5.4b, Q3 HYBRID): native <audio> + play/pause + 30 decorative bars
// (deterministic from the message id) that fill left-to-right by playback %. No audio decoding.
export default function VoicePlayer({ media, isOwn }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  const total = media.duration ?? 0;
  const uploading = media.uploadStatus === 'uploading';
  const src = media.localUrl ?? media.url;
  const bars = useMemo(() => generateWaveformBars(media.id), [media.id]);
  const progress = total > 0 ? Math.min(1, current / total) : 0;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) el.pause();
    else void el.play().catch(() => {});
  };

  return (
    <div
      className={cn(
        'flex w-56 max-w-full items-center gap-2 rounded-2xl px-3 py-2',
        isOwn ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted text-foreground',
      )}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
      />

      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause' : 'Play'}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isOwn ? 'bg-primary-foreground/20' : 'bg-foreground/10',
        )}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : playing ? (
          <Pause className="size-4" />
        ) : (
          <Play className="size-4 translate-x-px" />
        )}
      </button>

      <div className="flex h-8 flex-1 items-center gap-px">
        {bars.map((h, i) => {
          const filled = i / bars.length < progress;
          return (
            <span
              key={i}
              className={cn(
                'w-[2px] shrink-0 rounded-full',
                filled
                  ? isOwn
                    ? 'bg-primary-foreground'
                    : 'bg-primary'
                  : isOwn
                    ? 'bg-primary-foreground/40'
                    : 'bg-muted-foreground/30',
              )}
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>

      <span className="shrink-0 text-[0.7rem] tabular-nums opacity-80">
        {formatDuration(current > 0 ? current : total)}
      </span>
    </div>
  );
}
