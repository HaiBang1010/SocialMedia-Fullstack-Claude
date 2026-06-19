import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { generateWaveformBars } from '@/lib/audio';
import type { MusicPayload, MusicTrack } from '@/types/api';

interface MusicTrimmerProps {
  track: MusicTrack;
  onConfirm: (payload: MusicPayload) => void;
  onCancel: () => void;
}

const PREVIEW_MS = 30000; // iTunes previews are 30s
const MIN_CLIP = 5000;
const MAX_CLIP = 30000;
const DEFAULT_CLIP = 15000;
const BAR_COUNT = 40;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// Inline trim overlay (no nested Radix Dialog, mirrors the other story overlays). Pick the
// 5–30s slice of the 30s preview to attach: drag the highlighted window over a faux waveform
// (decorative bars from the track id — zero CORS/decode, see lib/audio.generateWaveformBars),
// adjust length with the slider, scrub-preview the clip. clipMs becomes the story's duration.
export default function MusicTrimmer({ track, onConfirm, onCancel }: MusicTrimmerProps) {
  const [startMs, setStartMs] = useState(0);
  const [clipMs, setClipMs] = useState(DEFAULT_CLIP);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const dragRef = useRef<{ startX: number; startMsAtDown: number } | null>(null);

  const bars = useMemo(() => generateWaveformBars(track.id, BAR_COUNT), [track.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Shrinking/growing the clip keeps the window inside the 30s preview.
  const onClipChange = (next: number) => {
    setClipMs(next);
    setStartMs((s) => clamp(s, 0, PREVIEW_MS - next));
  };

  const startFrac = startMs / PREVIEW_MS;
  const clipFrac = clipMs / PREVIEW_MS;
  const endMs = startMs + clipMs;

  // ── Drag the trim window (pointer events + setPointerCapture, the project idiom) ──
  const onWindowPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startMsAtDown: startMs };
  };
  const onWindowPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = timelineRef.current;
    if (!d || !el) return;
    const rect = el.getBoundingClientRect();
    const deltaMs = ((e.clientX - d.startX) / rect.width) * PREVIEW_MS;
    setStartMs(clamp(Math.round(d.startMsAtDown + deltaMs), 0, PREVIEW_MS - clipMs));
  };
  const onWindowPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
  };

  // ── Preview audio: play only the [startMs, endMs] window ──
  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
    } else {
      a.currentTime = startMs / 1000;
      void a.play().catch(() => undefined);
    }
  };

  // Keep the playhead inside the window while scrubbing the start.
  useEffect(() => {
    const a = audioRef.current;
    if (a && playing) a.currentTime = startMs / 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs]);

  const onTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const a = e.currentTarget;
    const ms = a.currentTime * 1000;
    setCurrentMs(ms);
    if (ms >= endMs) {
      a.pause();
      a.currentTime = startMs / 1000;
    }
  };

  const handleConfirm = () => {
    onConfirm({
      trackId: track.id,
      previewUrl: track.previewUrl,
      title: track.title,
      artist: track.artist,
      albumArt: track.albumArt,
      startMs: Math.round(startMs),
      clipMs,
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/90">
      {/* Header: cancel / done */}
      <div className="flex items-center justify-between p-3">
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirm}>Done</Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
        {/* Track header */}
        <div className="flex w-full max-w-sm items-center gap-3">
          <img src={track.albumArt} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-white">{track.title}</p>
            <p className="truncate text-sm text-white/60">{track.artist}</p>
          </div>
        </div>

        {/* Waveform + draggable trim window */}
        <div className="w-full max-w-sm">
          <div ref={timelineRef} className="relative h-16 w-full touch-none select-none">
            {/* Faux waveform bars */}
            <div className="flex h-full w-full items-center gap-px">
              {bars.map((h, i) => {
                const center = (i + 0.5) / bars.length;
                const inWindow = center >= startFrac && center <= startFrac + clipFrac;
                return (
                  <span
                    key={i}
                    className={cn(
                      'flex-1 rounded-full',
                      inWindow ? 'bg-primary' : 'bg-white/25',
                    )}
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>

            {/* Draggable highlighted window */}
            <div
              onPointerDown={onWindowPointerDown}
              onPointerMove={onWindowPointerMove}
              onPointerUp={onWindowPointerUp}
              onPointerCancel={onWindowPointerUp}
              className="absolute inset-y-0 cursor-grab touch-none rounded-lg border-2 border-primary bg-primary/10 active:cursor-grabbing"
              style={{ left: `${startFrac * 100}%`, width: `${clipFrac * 100}%` }}
            >
              <span className="absolute top-1/2 left-1 h-6 w-1 -translate-y-1/2 rounded-full bg-primary" />
              <span className="absolute top-1/2 right-1 h-6 w-1 -translate-y-1/2 rounded-full bg-primary" />
            </div>

            {/* Playhead (visible while previewing) */}
            {playing && (
              <span
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-white"
                style={{ left: `${(currentMs / PREVIEW_MS) * 100}%` }}
              />
            )}
          </div>

          {/* Time labels */}
          <div className="mt-1 flex justify-between text-[11px] tabular-nums text-white/50">
            <span>{(startMs / 1000).toFixed(1)}s</span>
            <span>{(endMs / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {/* Duration slider + preview button */}
        <div className="flex w-full max-w-sm items-center gap-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            {playing ? <Pause className="size-5" /> : <Play className="size-5 translate-x-px" />}
          </button>
          <div className="flex-1">
            <label className="mb-1 flex justify-between text-xs text-white/60">
              <span>Duration</span>
              <span className="tabular-nums">{Math.round(clipMs / 1000)}s</span>
            </label>
            <input
              type="range"
              min={MIN_CLIP}
              max={MAX_CLIP}
              step={1000}
              value={clipMs}
              onChange={(e) => onClipChange(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={track.previewUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={onTimeUpdate}
      />
    </div>
  );
}
