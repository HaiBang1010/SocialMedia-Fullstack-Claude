import { Button } from '@/components/ui/button';
import type { CreatePostPhase } from '@/features/posts/hooks/useCreatePost';

interface UploadStageProps {
  mediaKind: 'image' | 'video';
  phase: CreatePostPhase;
  progress: number;
  // 1-based index of the image currently uploading + total. When total > 1 the
  // label shows "Uploading 2/5…" so a multi-image wait reads as progress.
  uploadIndex: number;
  uploadTotal: number;
  error: Error | null;
  onRetry: () => void;
  onBack: () => void;
}

// Step 4 — upload progress / publish, or an error with retry. The container
// auto-advances to Done on success (it watches the mutation), so the happy path
// here is purely presentational.
export default function UploadStage({
  mediaKind,
  phase,
  progress,
  uploadIndex,
  uploadTotal,
  error,
  onRetry,
  onBack,
}: UploadStageProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <p className="text-sm font-medium text-foreground">
          We couldn't share your post
        </p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Something went wrong while uploading. Please try again.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      </div>
    );
  }

  // Progress only advances during the S3 PUT; the POST /posts leg shows a full
  // bar with a "Publishing…" label. For a carousel the upload label counts
  // images ("Uploading 2/5…").
  const label =
    phase === 'publishing'
      ? 'Publishing…'
      : mediaKind === 'video'
        ? 'Uploading video…'
        : uploadTotal > 1
          ? `Uploading ${uploadIndex}/${uploadTotal}…`
          : 'Uploading…';
  const pct = phase === 'publishing' ? 100 : progress;

  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14">
      <p className="text-sm font-medium">{label}</p>
      <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs tabular-nums text-muted-foreground">{pct}%</p>
    </div>
  );
}
