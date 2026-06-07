import { useRef, useState } from 'react';
import { ImagePlus, Film, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ACCEPT_ATTR,
  PASSTHROUGH_MIME,
  getImageDimensions,
  validateMediaFile,
} from '@/lib/image';
import {
  VIDEO_MIME,
  getVideoMetadata,
  isVideoFile,
  validateVideoFile,
} from '@/lib/video';
import { formatDuration } from '@/lib/format';
import { MAX_IMAGES, type ComposerImage, type ComposerVideo } from './types';
import ImageStrip from './ImageStrip';

interface SelectStageProps {
  flow: 'image' | 'video' | null;
  images: ComposerImage[];
  video: ComposerVideo | null;
  onAdd: (added: ComposerImage[]) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onPickVideo: (video: ComposerVideo) => void;
  onClearVideo: () => void;
  onNext: () => void;
}

// Accept both images and a single MP4. The <input> accepts the union; the file
// type chosen first decides the flow.
const SELECT_ACCEPT = [ACCEPT_ATTR, ...VIDEO_MIME].join(',');

// Step 1 — pick / drop media. Images go down the multi-image carousel flow (up to
// 5, validated against the backend contract); a single MP4 goes down the video
// flow. The two cannot be mixed: a video must be posted on its own.
export default function SelectStage({
  flow,
  images,
  video,
  onAdd,
  onRemove,
  onReorder,
  onPickVideo,
  onClearVideo,
  onNext,
}: SelectStageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    // ── Video branch: must be a single MP4, on its own ──
    if (files.some(isVideoFile)) {
      if (files.length > 1 || flow === 'image' || images.length > 0) {
        setError('A video must be posted on its own (no other media).');
        return;
      }
      const file = files[0];
      const vErr = validateVideoFile(file);
      if (vErr) {
        setError(vErr);
        return;
      }
      try {
        const metadata = await getVideoMetadata(file);
        onPickVideo({
          id: crypto.randomUUID(),
          file,
          dimensions: { width: metadata.width, height: metadata.height },
          duration: metadata.duration,
          prepared: null,
        });
        setError(null);
      } catch {
        setError('Could not read the video. Try a different file.');
      }
      return;
    }

    // ── Image branch ──
    if (flow === 'video' || video) {
      setError('A video must be posted on its own (no other media).');
      return;
    }

    // 1. Per-file MIME + size validation. One message covers the rejects.
    const valid = files.filter((f) => validateMediaFile(f) === null);
    if (valid.length === 0) {
      setError(
        'Unsupported file type or too large. Use JPEG, PNG, WebP, GIF, or AVIF up to 10MB, or an MP4 up to 50MB.',
      );
      return;
    }

    // 2. Passthrough (GIF/AVIF) must be posted on its own — it keeps original
    //    framing and can't share a carousel's aspect ratio.
    const currentHasPassthrough = images.some((i) => i.isPassthrough);
    const incomingPassthrough = valid.some((f) => PASSTHROUGH_MIME.has(f.type));
    const wouldMix =
      incomingPassthrough && (images.length > 0 || valid.length > 1);
    if (currentHasPassthrough || wouldMix) {
      setError('GIF and AVIF can only be posted on their own.');
      return;
    }

    // 3. Max-5 cap (client mirror of the backend .max(5)).
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`You can add up to ${MAX_IMAGES} photos.`);
      return;
    }
    const slice = valid.slice(0, remaining);

    // 4. Measure dimensions, build ComposerImage[].
    try {
      const added: ComposerImage[] = [];
      for (const file of slice) {
        const dimensions = await getImageDimensions(file);
        added.push({
          id: crypto.randomUUID(),
          file,
          dimensions,
          isPassthrough: PASSTHROUGH_MIME.has(file.type),
          cropped: null,
        });
      }
      setError(
        slice.length < valid.length ? `You can add up to ${MAX_IMAGES} photos.` : null,
      );
      onAdd(added);
    } catch {
      setError('Could not read one of the images. Try a different file.');
    }
  };

  // ── Video selected: confirmation card + Next ──
  if (flow === 'video' && video) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-4 rounded-xl border bg-muted/40 p-4">
          <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-muted">
            <Film className="size-6 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{video.file.name}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(video.duration)} · {video.dimensions.width}×
              {video.dimensions.height}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove video"
            onClick={onClearVideo}
          >
            <X className="size-4" />
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">1 video selected</span>
          <Button onClick={onNext}>Next</Button>
        </div>
      </div>
    );
  }

  const atCap = images.length >= MAX_IMAGES;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex w-full flex-col items-center gap-4 rounded-xl border-2 border-dashed py-12 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
          atCap && 'opacity-50',
        )}
      >
        <ImagePlus className="size-12 text-muted-foreground" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-medium">
            {images.length > 0 ? 'Add more photos' : 'Drag photos or a video here'}
          </p>
          <p className="text-xs text-muted-foreground">
            {images.length > 0
              ? `JPEG, PNG, WebP, GIF, or AVIF · up to 10MB · max ${MAX_IMAGES} photos`
              : 'Photos (max 5) or one MP4 video · up to 10MB / 50MB'}
          </p>
        </div>
        <Button disabled={atCap} onClick={() => inputRef.current?.click()}>
          {images.length > 0 ? 'Add photos' : 'Select from device'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={SELECT_ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = ''; // allow re-selecting the same file
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {images.length > 0 && (
        <>
          <ImageStrip images={images} onRemove={onRemove} onReorder={onReorder} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tabular-nums">
              {images.length}/{MAX_IMAGES} selected
            </span>
            <Button onClick={onNext}>Next</Button>
          </div>
        </>
      )}
    </div>
  );
}
