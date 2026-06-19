import { useEffect, useState } from 'react';
import { Music, Search, X } from 'lucide-react';
import Spinner from '@/components/common/Spinner';
import { Button } from '@/components/ui/button';
import { useSearchMusic } from '@/features/music/hooks/useSearchMusic';
import { formatDuration } from '@/lib/audio';
import type { MusicTrack } from '@/types/api';

interface MusicPickerProps {
  onSelect: (track: MusicTrack) => void;
  onCancel: () => void;
}

// Inline music-search overlay (same hand-rolled approach as AddTextOverlay / EmojiPickerOverlay —
// no nested Radix Dialog). Debounced search → iTunes proxy; tap a track to open the trimmer.
export default function MusicPicker({ onSelect, onCancel }: MusicPickerProps) {
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');

  // Debounce the query (300ms) so we don't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQ(input), 300);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const { data: tracks, isFetching, isError } = useSearchMusic(q);
  const hasQuery = q.trim().length > 0;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-black/90">
      {/* Header: cancel + search input */}
      <div className="flex items-center gap-2 p-3">
        <Button variant="ghost" className="shrink-0 text-white hover:bg-white/10" onClick={onCancel}>
          Cancel
        </Button>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/50" />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search for music"
            className="w-full rounded-full bg-white/10 py-2 pr-9 pl-9 text-sm text-white placeholder:text-white/50 focus:bg-white/15 focus:outline-none"
          />
          {input && (
            <button
              type="button"
              aria-label="Clear"
              onClick={() => setInput('')}
              className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-white/60 hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!hasQuery ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/50">
            <Music className="size-8" />
            <p className="text-sm">Search for music</p>
          </div>
        ) : isFetching ? (
          <div className="grid place-items-center py-10">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="py-10 text-center text-sm text-white/60">
            Couldn&apos;t load music. Try again.
          </p>
        ) : !tracks || tracks.length === 0 ? (
          <p className="py-10 text-center text-sm text-white/60">No results for “{q}”.</p>
        ) : (
          <ul className="flex flex-col">
            {tracks.map((track) => (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() => onSelect(track)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/10"
                >
                  <img
                    src={track.albumArt}
                    alt=""
                    className="size-12 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{track.title}</p>
                    <p className="truncate text-xs text-white/60">{track.artist}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-white/50">
                    {formatDuration(Math.round(track.durationMs / 1000))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
