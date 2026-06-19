import { useEffect, useRef, useState } from 'react';
import { Type, Smile, Music, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import StoryOverlay from './StoryOverlay';
import TrashZone from './TrashZone';
import AddTextOverlay from './AddTextOverlay';
import EmojiPickerOverlay from './EmojiPickerOverlay';
import MusicPicker from '@/components/music/MusicPicker';
import MusicTrimmer from '@/components/music/MusicTrimmer';
import { useOverlayDrag } from '@/hooks/useOverlayDrag';
import type { StoryMediaPayload } from '@/features/stories/hooks/useCreateStory';
import type { MusicPayload, MusicTrack, StoryItem, StoryItemInput } from '@/types/api';

interface StoryEditStageProps {
  media: StoryMediaPayload; // cropped 9:16 image OR a video (+ its poster) as the background
  onBack: () => void; // discard overlays → back to crop (image) / video stage
  onClose: () => void; // discard everything → close the composer
  onComplete: (items: StoryItemInput[]) => void;
}

// Editor overlays carry a client-side temp id (React keys + selection + drag identity);
// it's stripped back to StoryItemInput on submit. Module-level counter keeps ids unique
// and deterministic across opens.
let tempIdCounter = 0;
const nextTempId = () => `tmp-${tempIdCounter++}`;

const SOFT_LIMIT = 20; // soft UX warning only — backend has no hard cap

// Step 3 (image + video flow) — drop draggable TEXT / EMOJI overlays onto the cropped image
// or the video's paused first frame. The layout MIRRORS StoryViewer (max-w-md column, h-20
// top + h-20 bottom chrome, same content zone + object-fit per media type) so an overlay's
// normalized x/y lands on the same spot when the story is viewed. Drag-to-reposition +
// drag-to-trash; tap to (de)select.
export default function StoryEditStage({ media, onBack, onClose, onComplete }: StoryEditStageProps) {
  const [bgUrl, setBgUrl] = useState('');
  const [items, setItems] = useState<StoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddText, setShowAddText] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [pickedTrack, setPickedTrack] = useState<MusicTrack | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Video stories use the original clip as the background (paused first frame); images use
  // the cropped blob. media.blob is the video file or the image either way.
  const isVideo = media.contentType === 'video/mp4';

  // Object URL for the background media (revoke on unmount).
  useEffect(() => {
    const url = URL.createObjectURL(media.blob);
    setBgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [media]);

  const drag = useOverlayDrag({
    contentRef,
    onDrag: (id, x, y) =>
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, x, y } : it))),
    onDragEnd: (id, x, y, inTrash) => {
      if (inTrash) {
        setItems((prev) => prev.filter((it) => it.id !== id));
        setSelectedId((cur) => (cur === id ? null : cur));
      } else {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, x, y } : it)));
      }
    },
    onSelect: (id) => setSelectedId((cur) => (cur === id ? null : id)),
  });

  const addText = (text: string) => {
    const id = nextTempId();
    setItems((prev) => [
      ...prev,
      { id, type: 'TEXT', x: 0.5, y: 0.5, scale: 1, rotation: 0, payload: { text } },
    ]);
    setSelectedId(id);
    setShowAddText(false);
  };

  const addEmoji = (emoji: string) => {
    const id = nextTempId();
    setItems((prev) => [
      ...prev,
      { id, type: 'EMOJI', x: 0.5, y: 0.5, scale: 1, rotation: 0, payload: { emoji } },
    ]);
    setSelectedId(id);
    setShowEmoji(false);
  };

  // Music sticker is added center, like text/emoji. clipMs (in the payload) becomes the story's
  // duration in the viewer. Backend caps at one MUSIC item/story; the toolbar button guards too.
  const addMusic = (payload: MusicPayload) => {
    const id = nextTempId();
    setItems((prev) => [
      ...prev,
      { id, type: 'MUSIC', x: 0.5, y: 0.5, scale: 1, rotation: 0, payload },
    ]);
    setSelectedId(id);
    setPickedTrack(null);
    setShowMusicPicker(false);
  };

  const handleShare = () => {
    // Strip the temp id back to StoryItemInput. Explicit per-type branches keep the literal
    // discriminant + narrowed payload (a generic spread would widen the union).
    const toInput = (it: StoryItem): StoryItemInput => {
      const base = { x: it.x, y: it.y, scale: it.scale, rotation: it.rotation };
      switch (it.type) {
        case 'TEXT':
          return { type: 'TEXT', ...base, payload: it.payload };
        case 'EMOJI':
          return { type: 'EMOJI', ...base, payload: it.payload };
        case 'MUSIC':
          return { type: 'MUSIC', ...base, payload: it.payload };
      }
    };
    onComplete(items.map(toInput));
  };

  const hasMusic = items.some((it) => it.type === 'MUSIC');

  return (
    <div className="relative mx-auto flex h-full w-full max-w-md flex-col bg-black">
      {/* TOP chrome — mirrors the viewer's progress + header zone (h-20). Editor renders its
          own white controls (the composer hides the Radix close X on this step to avoid a
          collision + dark-on-black contrast): X discards everything, Back returns to crop. */}
      <div className="flex h-20 shrink-0 items-center justify-between px-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full text-white transition-colors hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onBack}>
            Back
          </Button>
        </div>
        <Button onClick={handleShare}>Share</Button>
      </div>

      {/* CONTENT — image + overlays. Tap an empty spot to deselect. */}
      <div
        ref={contentRef}
        onPointerDown={() => setSelectedId(null)}
        className="relative flex-1 overflow-hidden"
      >
        {bgUrl &&
          (isVideo ? (
            // Paused first frame (seek 0.1s, matching the poster) — no autoplay so the CPU
            // is free for dragging. object-contain + black letterbox mirrors the viewer.
            <video
              ref={videoRef}
              src={bgUrl}
              muted
              playsInline
              preload="metadata"
              onLoadedMetadata={() => {
                if (videoRef.current) videoRef.current.currentTime = 0.1;
              }}
              className="absolute inset-0 size-full bg-black object-contain"
            />
          ) : (
            <img src={bgUrl} alt="" className="absolute inset-0 size-full object-cover" />
          ))}
        {items.map((item) => (
          <StoryOverlay
            key={item.id}
            item={item}
            editable
            isSelected={selectedId === item.id}
            isDragging={drag.draggingId === item.id}
            {...drag.getHandlers(item)}
          />
        ))}
        <TrashZone visible={drag.draggingId !== null} isNear={drag.isNearTrash} />
      </div>

      {/* BOTTOM chrome — toolbar, mirrors the viewer's reply-placeholder zone (h-20). */}
      <div className="flex h-20 shrink-0 flex-col items-center justify-center gap-1 px-4">
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => setShowAddText(true)}>
            <Type className="size-4" /> Add text
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setShowEmoji(true)}>
            <Smile className="size-4" /> Emoji
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={hasMusic}
            onClick={() => setShowMusicPicker(true)}
          >
            <Music className="size-4" /> Music
          </Button>
        </div>
        {items.length > SOFT_LIMIT && (
          <span className="text-[11px] text-amber-400">
            Lots of overlays — your story may look cluttered
          </span>
        )}
      </div>

      {showAddText && (
        <AddTextOverlay onCommit={addText} onCancel={() => setShowAddText(false)} />
      )}
      {showEmoji && (
        <EmojiPickerOverlay onCommit={addEmoji} onCancel={() => setShowEmoji(false)} />
      )}
      {showMusicPicker && !pickedTrack && (
        <MusicPicker onSelect={setPickedTrack} onCancel={() => setShowMusicPicker(false)} />
      )}
      {pickedTrack && (
        <MusicTrimmer track={pickedTrack} onConfirm={addMusic} onCancel={() => setPickedTrack(null)} />
      )}
    </div>
  );
}
