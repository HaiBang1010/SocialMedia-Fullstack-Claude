import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  buildVideoMedia,
  extractVideoThumbnail,
  type ImageDimensions,
  type VideoMedia,
} from '@/lib/video';
import { formatDuration } from '@/lib/format';

interface VideoStageProps {
  file: File;
  dimensions: ImageDimensions; // intrinsic video dimensions
  duration: number; // seconds
  onBack: () => void;
  onComplete: (prepared: VideoMedia) => void;
}

// Step 2 for the video flow (replaces CropStage). Shows a muted, looping preview
// and extracts a poster frame in the background (Canvas + <video> seek, see
// lib/video). There is no crop / aspect lock — the video is posted as-is and
// letterboxed on render. "Next" is gated until the poster is ready.
export default function VideoStage({
  file,
  dimensions,
  duration,
  onBack,
  onComplete,
}: VideoStageProps) {
  const [previewUrl, setPreviewUrl] = useState('');
  const [thumbnail, setThumbnail] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Object URL for the preview <video>.
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Extract the poster on mount (background). Guarded against unmount.
  useEffect(() => {
    let cancelled = false;
    setThumbnail(null);
    setError(null);
    extractVideoThumbnail(file)
      .then((blob) => {
        if (!cancelled) setThumbnail(blob);
      })
      .catch(() => {
        if (!cancelled) setError('Could not prepare the video poster.');
      });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const handleNext = () => {
    if (!thumbnail) return;
    onComplete(
      buildVideoMedia(
        file,
        { width: dimensions.width, height: dimensions.height, duration },
        thumbnail,
      ),
    );
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-center bg-black p-4">
        {previewUrl && (
          <video
            src={previewUrl}
            muted
            autoPlay
            loop
            playsInline
            className="max-h-[60vh] w-auto object-contain"
          />
        )}
      </div>

      <div className="flex items-center justify-center gap-2 px-4 pt-3 text-xs text-muted-foreground tabular-nums">
        <span>{formatDuration(duration)}</span>
        <span aria-hidden>·</span>
        <span>
          {dimensions.width}×{dimensions.height}
        </span>
      </div>

      <p className="px-4 pt-1 text-center text-xs text-muted-foreground">
        {error
          ? error
          : thumbnail
            ? 'Video keeps its original framing.'
            : 'Preparing poster…'}
      </p>

      <div className="flex justify-between gap-3 border-t p-4">
        <Button variant="ghost" onClick={onBack}>
          Replace video
        </Button>
        <Button onClick={handleNext} disabled={!thumbnail}>
          Next
        </Button>
      </div>
    </div>
  );
}
