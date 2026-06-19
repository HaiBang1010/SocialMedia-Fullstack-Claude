import { Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MusicPayload } from '@/types/api';

interface MusicStickerProps {
  payload: MusicPayload;
  selected?: boolean;
}

// Compact IG-style music sticker: album cover + a note icon + a scrolling title. Purely
// presentational — audio playback is owned by the viewer; in the editor the shared overlay
// machinery (useOverlayDrag) handles drag/position. The title marquee uses two identical
// padded copies so translateX(-50%) loops seamlessly (see .animate-music-marquee in index.css).
export default function MusicSticker({ payload, selected = false }: MusicStickerProps) {
  const label = `${payload.title} · ${payload.artist}`;
  return (
    <div
      className={cn(
        'inline-flex select-none items-center gap-2 rounded-full bg-black/55 py-1.5 pr-3 pl-1.5 text-white backdrop-blur-sm',
        selected && 'ring-2 ring-white/70',
      )}
    >
      <img
        src={payload.albumArt}
        alt=""
        draggable={false}
        className="size-7 shrink-0 rounded-full object-cover"
      />
      <Music className="size-3.5 shrink-0" />
      <div className="w-24 overflow-hidden">
        <div className="flex w-max animate-music-marquee whitespace-nowrap text-xs font-medium">
          <span className="pr-8">{label}</span>
          <span className="pr-8" aria-hidden>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}
