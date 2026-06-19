import { cn } from '@/lib/utils';
import MusicSticker from '@/components/music/MusicSticker';
import type { StoryItem } from '@/types/api';

interface StoryOverlayProps {
  item: StoryItem;
  editable?: boolean;
  isSelected?: boolean;
  isDragging?: boolean;
  // Pointer handlers come from useOverlayDrag (editor only). Omitted in the viewer.
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
}

// A single story overlay — reused by the editor (editable, draggable) and the viewer
// (read-only). Positioned by x/y (0-1 of the content zone) with a translate(-50%,-50%)
// anchor so the value is the overlay's CENTER; scale/rotation are applied but fixed at
// 1/0 in 4.3a. Editable overlays capture pointer events; viewer overlays let taps fall
// through to the gesture layer (pointer-events-none).
export default function StoryOverlay({
  item,
  editable = false,
  isSelected = false,
  isDragging = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: StoryOverlayProps) {
  return (
    <div
      className={cn(
        // max-w-[80%] resolves against the content zone (positioned ancestor); the div then
        // shrinks to the inline-block child, so the ring (on the child) hugs the text exactly.
        'absolute max-w-[80%]',
        editable
          ? 'pointer-events-auto cursor-grab touch-none active:cursor-grabbing'
          : 'pointer-events-none',
        isDragging && 'z-10',
      )}
      style={{
        left: `${item.x * 100}%`,
        top: `${item.y * 100}%`,
        transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {item.type === 'TEXT' ? (
        <span
          className={cn(
            'inline-block max-w-full whitespace-pre-wrap break-words rounded bg-black/30 px-2 py-1 text-center text-3xl font-bold text-white [text-shadow:_0_1px_4px_rgb(0_0_0_/_0.6)]',
            isSelected && 'ring-2 ring-white/70',
          )}
        >
          {item.payload.text}
        </span>
      ) : item.type === 'MUSIC' ? (
        <MusicSticker payload={item.payload} selected={isSelected} />
      ) : (
        <span
          className={cn(
            'inline-block select-none rounded text-6xl leading-none',
            isSelected && 'ring-2 ring-white/70 ring-offset-2 ring-offset-transparent',
          )}
        >
          {item.payload.emoji}
        </span>
      )}
    </div>
  );
}
