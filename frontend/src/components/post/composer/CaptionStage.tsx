import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { PostVisibility } from '@/types/api';
import { type ComposerImage } from './types';
import ImageStrip from './ImageStrip';

// IG caption limit — must match the backend `caption.max(2200)`.
const CAPTION_MAX = 2200;

const VISIBILITY_OPTIONS: { value: PostVisibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Public — anyone can see' },
  { value: 'FOLLOWERS', label: 'Followers — only people who follow you' },
  { value: 'PRIVATE', label: 'Private — only you' },
];

interface CaptionStageProps {
  images: ComposerImage[]; // all cropped by this point
  caption: string;
  visibility: PostVisibility;
  onCaptionChange: (value: string) => void;
  onVisibilityChange: (value: PostVisibility) => void;
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onBack: () => void;
  onShare: () => void;
}

// Step 3 — big preview of the first image + caption + visibility, plus the strip
// for a final reorder/remove when it's a carousel. "Share" hands control to the
// container, which fires the mutation and advances to the Upload step.
export default function CaptionStage({
  images,
  caption,
  visibility,
  onCaptionChange,
  onVisibilityChange,
  onRemove,
  onReorder,
  onBack,
  onShare,
}: CaptionStageProps) {
  const primary = images[0]?.cropped ?? null;
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!primary) return;
    const url = URL.createObjectURL(primary.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [primary]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        {/* First-image preview */}
        <div className="mx-auto w-40 shrink-0 overflow-hidden rounded-lg bg-muted sm:mx-0">
          {previewUrl && primary && (
            <img
              src={previewUrl}
              alt=""
              className="size-full object-cover"
              style={{ aspectRatio: primary.width / primary.height }}
            />
          )}
        </div>

        {/* Caption + visibility */}
        <div className="flex flex-1 flex-col gap-3">
          <div>
            <textarea
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value.slice(0, CAPTION_MAX))}
              placeholder="Write a caption…"
              rows={5}
              className="w-full resize-none rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
              {caption.length}/{CAPTION_MAX}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Visibility</span>
            <select
              value={visibility}
              onChange={(e) => onVisibilityChange(e.target.value as PostVisibility)}
              className="rounded-lg border bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Carousel review: reorder / remove before sharing */}
      {images.length > 1 && (
        <div className="border-t px-4 py-3">
          <ImageStrip images={images} onRemove={onRemove} onReorder={onReorder} />
        </div>
      )}

      <div className="flex justify-between gap-3 border-t p-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onShare}>Share</Button>
      </div>
    </div>
  );
}
