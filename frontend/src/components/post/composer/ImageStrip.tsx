import { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComposerImage } from './types';

interface ImageStripProps {
  images: ComposerImage[];
  onRemove: (id: string) => void;
  onReorder: (from: number, to: number) => void; // move item `from` → `to`
}

// Thumbnail strip for the composer: remove (X) + reorder (◀ ▶ swaps with the
// neighbour). Object URLs are cached per image id and recreated only when that
// image's source blob changes (re-crop), so reorder doesn't churn URLs. All
// URLs are revoked on unmount.
export default function ImageStrip({ images, onRemove, onReorder }: ImageStripProps) {
  const cacheRef = useRef<Map<string, { blob: Blob; url: string }>>(new Map());
  const [urls, setUrls] = useState<Record<string, string>>({});

  // Sync the URL cache to the current images (add new, replace on re-crop,
  // revoke removed). The source blob is the cropped output once available, else
  // the original file (e.g. before cropping, or GIF/AVIF passthrough).
  useEffect(() => {
    const cache = cacheRef.current;
    const next: Record<string, string> = {};
    const live = new Set<string>();

    for (const img of images) {
      live.add(img.id);
      const blob = img.cropped?.blob ?? img.file;
      const entry = cache.get(img.id);
      if (entry && entry.blob === blob) {
        next[img.id] = entry.url;
      } else {
        if (entry) URL.revokeObjectURL(entry.url);
        const url = URL.createObjectURL(blob);
        cache.set(img.id, { blob, url });
        next[img.id] = url;
      }
    }

    for (const [id, entry] of cache) {
      if (!live.has(id)) {
        URL.revokeObjectURL(entry.url);
        cache.delete(id);
      }
    }

    setUrls(next);
  }, [images]);

  // Revoke any remaining URLs when the strip unmounts.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      for (const entry of cache.values()) URL.revokeObjectURL(entry.url);
      cache.clear();
    };
  }, []);

  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-1">
      {images.map((img, i) => (
        <div
          key={img.id}
          className="relative size-20 shrink-0 overflow-hidden rounded-lg border bg-muted"
        >
          {urls[img.id] && (
            <img src={urls[img.id]} alt="" className="size-full object-cover" />
          )}

          <button
            type="button"
            onClick={() => onRemove(img.id)}
            aria-label="Remove photo"
            className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <X className="size-3" />
          </button>

          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/40">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => onReorder(i, i - 1)}
                aria-label="Move left"
                className="grid size-5 place-items-center text-white disabled:opacity-30"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                disabled={i === images.length - 1}
                onClick={() => onReorder(i, i + 1)}
                aria-label="Move right"
                className="grid size-5 place-items-center text-white disabled:opacity-30"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
