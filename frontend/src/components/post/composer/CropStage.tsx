import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  computeCropRect,
  cropToBlob,
  coverScale,
  maxOffset,
  outputTypeFor,
  type CropOffset,
  type CroppedImage,
} from '@/lib/cropImage';
import type { AcceptedMime, ImageDimensions } from '@/lib/image';

const RATIOS: { value: number; label: string }[] = [
  { value: 1, label: '1:1' },
  { value: 0.8, label: '4:5' },
  { value: 1.91, label: '1.91' },
];

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

interface CropStageProps {
  file: File;
  dimensions: ImageDimensions;
  isPassthrough: boolean; // GIF/AVIF — upload as-is, no canvas re-encode
  ratio: number; // shared aspect ratio, owned by the container (IG: chosen once)
  onRatioChange: (ratio: number) => void; // only effective while !ratioLocked
  ratioLocked: boolean; // images 2..N inherit the first image's ratio
  onBack: () => void;
  onComplete: (prepared: CroppedImage) => void;
}

// Step 2 — hand-rolled crop. The image is "cover"-fit into a fixed-ratio
// viewport, then pan (drag) + zoom (slider/wheel) reposition it; the viewport
// maps back to a source rect we draw onto a canvas (see lib/cropImage).
// GIF/AVIF skip all of this and pass through untouched (animation would be lost
// through a canvas), keeping only their measured dimensions.
export default function CropStage({
  file,
  dimensions,
  isPassthrough,
  ratio,
  onRatioChange,
  ratioLocked,
  onBack,
  onComplete,
}: CropStageProps) {
  const { width: natW, height: natH } = dimensions;

  const [previewUrl, setPreviewUrl] = useState('');
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<CropOffset>({ x: 0, y: 0 });
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Object URL for the preview <img> (also the canvas draw source).
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Measure the viewport (its aspect changes with `ratio`) so we can compute the
  // cover scale used for both rendering and the final crop math.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setVp({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isPassthrough]);

  const clampOffset = (next: CropOffset, z: number): CropOffset => {
    if (!vp.w || !vp.h) return next;
    const max = maxOffset(natW, natH, vp.w, vp.h, z);
    return {
      x: Math.min(Math.max(next.x, -max.x), max.x),
      y: Math.min(Math.max(next.y, -max.y), max.y),
    };
  };

  // Switching ratio reshapes the viewport → recenter (old offset is invalid).
  // No-op once locked (images 2..N share the first image's ratio).
  const changeRatio = (value: number) => {
    if (ratioLocked) return;
    onRatioChange(value);
    setOffset({ x: 0, y: 0 });
  };

  // Re-clamp whenever zoom or the measured viewport changes.
  useEffect(() => {
    setOffset((o) => clampOffset(o, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, vp.w, vp.h]);

  // Non-passive wheel listener so preventDefault actually blocks page scroll.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || isPassthrough) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * 0.001)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [isPassthrough]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, zoom));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  const handleComplete = async () => {
    if (isPassthrough) {
      onComplete({
        blob: file,
        contentType: file.type as AcceptedMime,
        width: natW,
        height: natH,
      });
      return;
    }

    const img = imgRef.current;
    if (!img || !vp.w || !vp.h) return;
    setBusy(true);
    try {
      if (!img.complete) await img.decode().catch(() => undefined);
      const rect = computeCropRect({
        natW,
        natH,
        ratio,
        zoom,
        offset,
        viewportW: vp.w,
        viewportH: vp.h,
      });
      const prepared = await cropToBlob(img, rect, ratio, outputTypeFor(file.type));
      onComplete(prepared);
    } finally {
      setBusy(false);
    }
  };

  // ── Passthrough (GIF/AVIF): preview only, no crop controls ──
  if (isPassthrough) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center justify-center bg-black p-4">
          {previewUrl && (
            <img
              src={previewUrl}
              alt=""
              className="max-h-[60vh] w-auto object-contain"
            />
          )}
        </div>
        <p className="px-4 pt-3 text-center text-xs text-muted-foreground">
          GIF and AVIF keep their original framing.
        </p>
        <div className="flex justify-between gap-3 border-t p-4">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleComplete}>Next</Button>
        </div>
      </div>
    );
  }

  // ── Croppable (JPEG/PNG/WebP) ──
  const base = vp.w && vp.h ? coverScale(natW, natH, vp.w, vp.h) : 0;
  const dispW = natW * base * zoom;
  const dispH = natH * base * zoom;

  return (
    <div className="flex flex-col">
      {/* Crop viewport */}
      <div className="flex items-center justify-center bg-black p-4">
        <div
          ref={viewportRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative max-h-[60vh] w-full max-w-md touch-none cursor-grab overflow-hidden bg-muted active:cursor-grabbing"
          style={{ aspectRatio: ratio }}
        >
          {previewUrl && (
            <img
              ref={imgRef}
              src={previewUrl}
              alt=""
              draggable={false}
              className="absolute top-1/2 left-1/2 select-none"
              style={{
                width: dispW || undefined,
                height: dispH || undefined,
                maxWidth: 'none',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
        </div>
      </div>

      {/* Controls: ratio + zoom */}
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center justify-center gap-2">
            {RATIOS.map((r) => (
              <Button
                key={r.label}
                type="button"
                size="sm"
                variant={ratio === r.value ? 'default' : 'outline'}
                disabled={ratioLocked}
                onClick={() => changeRatio(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          {ratioLocked && (
            <p className="text-xs text-muted-foreground">
              All photos share the first photo's ratio
            </p>
          )}
        </div>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="w-full accent-primary"
        />
      </div>

      <div className="flex justify-between gap-3 border-t p-4">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          Back
        </Button>
        <Button onClick={handleComplete} disabled={busy || !base}>
          Next
        </Button>
      </div>
    </div>
  );
}
