import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  ACCEPT_ATTR,
  PASSTHROUGH_MIME,
  getImageDimensions,
  validateMediaFile,
} from '@/lib/image';
import { MAX_IMAGES, type ComposerImage } from './types';
import ImageStrip from './ImageStrip';

interface SelectStageProps {
  images: ComposerImage[];
  onAdd: (added: ComposerImage[]) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onNext: () => void;
}

// Step 1 — pick / drop up to 5 photos. Validates against the backend contract
// (5 MIME, 10MB) and measures dimensions BEFORE handing off, so an invalid file
// never reaches the crop step or costs a presign call. GIF/AVIF can only be
// posted on their own (they can't be forced to a carousel's shared aspect).
export default function SelectStage({
  images,
  onAdd,
  onRemove,
  onReorder,
  onNext,
}: SelectStageProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    // 1. Per-file MIME + size validation. One message covers the rejects.
    const valid = files.filter((f) => validateMediaFile(f) === null);
    if (valid.length === 0) {
      setError(
        'Unsupported file type or too large. Use JPEG, PNG, WebP, GIF, or AVIF up to 10MB.',
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
            {images.length > 0 ? 'Add more photos' : 'Drag photos here'}
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, WebP, GIF, or AVIF · up to 10MB · max {MAX_IMAGES} photos
          </p>
        </div>
        <Button disabled={atCap} onClick={() => inputRef.current?.click()}>
          {images.length > 0 ? 'Add photos' : 'Select from device'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
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
