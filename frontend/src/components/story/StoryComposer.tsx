import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useStoryComposerStore } from '@/stores/storyComposerStore';
import { useStoryViewerStore } from '@/stores/storyViewerStore';
import { useAuthStore } from '@/stores/authStore';
import {
  useCreateStory,
  type StoryMediaPayload,
} from '@/features/stories/hooks/useCreateStory';
import type { ImageDimensions } from '@/lib/image';
import type { CroppedImage } from '@/lib/cropImage';
import type { VideoMedia } from '@/lib/video';
import type { StoryItemInput } from '@/types/api';
import SelectStoryStage from './SelectStoryStage';
import StoryCropStage from './StoryCropStage';
import StoryEditStage from './StoryEditStage';
import VideoStage from '@/components/post/composer/VideoStage';

type Step = 'select' | 'crop' | 'edit' | 'video' | 'upload' | 'done';

const STEP_TITLE: Record<Step, string> = {
  select: 'New story',
  crop: 'Crop',
  edit: 'Edit',
  video: 'Video',
  upload: 'Sharing',
  done: 'Done',
};

interface PickedImage {
  file: File;
  dimensions: ImageDimensions;
}
interface PickedVideo {
  file: File;
  dimensions: ImageDimensions;
  duration: number;
}

// Global story-composer modal — a single instance mounted in AppLayout, driven by
// storyComposerStore. SLIM (not a fork of PostComposerModal): single media, force
// 9:16 for images, no caption. Flow:
//   image: select → crop → upload → done
//   video: select → video → upload → done
// Reuses the post composer's VideoStage + cropImage utilities + useCreateStory
// orchestration; crop and select are story-specific (StoryCropStage / SelectStoryStage).
export default function StoryComposer() {
  const isOpen = useStoryComposerStore((s) => s.isOpen);
  const close = useStoryComposerStore((s) => s.close);
  const openViewer = useStoryViewerStore((s) => s.open);
  const me = useAuthStore((s) => s.user);
  const create = useCreateStory();

  const [step, setStep] = useState<Step>('select');
  const [image, setImage] = useState<PickedImage | null>(null);
  const [video, setVideo] = useState<PickedVideo | null>(null);
  // The prepared media (cropped image OR video) handed to the edit step.
  const [editingMedia, setEditingMedia] = useState<StoryMediaPayload | null>(null);
  // The prepared payload + overlays currently being uploaded — kept so the error screen can retry.
  const [pending, setPending] = useState<{ media: StoryMediaPayload; items: StoryItemInput[] } | null>(
    null,
  );

  const resetAll = () => {
    setStep('select');
    setImage(null);
    setVideo(null);
    setEditingMedia(null);
    setPending(null);
    create.reset();
  };

  const closeAndReset = () => {
    close();
    resetAll();
  };

  // Step → Done once the mutation resolves.
  useEffect(() => {
    if (create.isSuccess && step === 'upload') setStep('done');
  }, [create.isSuccess, step]);

  const handlePickImage = (file: File, dimensions: ImageDimensions) => {
    setVideo(null);
    setImage({ file, dimensions });
    setStep('crop');
  };
  const handlePickVideo = (file: File, dimensions: ImageDimensions, duration: number) => {
    setImage(null);
    setVideo({ file, dimensions, duration });
    setStep('video');
  };

  const submit = (media: StoryMediaPayload, items: StoryItemInput[] = []) => {
    setPending({ media, items });
    setStep('upload');
    create.submit({ media, items });
  };

  const handleViewStory = () => {
    closeAndReset();
    // Self isn't in the feed → single-user mode reads /users/:username/stories.
    if (me) openViewer({ mode: 'single-user', startUsername: me.username });
  };

  const renderStep = () => {
    switch (step) {
      case 'select':
        return (
          <SelectStoryStage onPickImage={handlePickImage} onPickVideo={handlePickVideo} />
        );
      case 'crop':
        return image ? (
          <StoryCropStage
            key={image.file.name}
            file={image.file}
            dimensions={image.dimensions}
            onBack={() => {
              setImage(null);
              setStep('select');
            }}
            onComplete={(prepared: CroppedImage) => {
              setEditingMedia(prepared);
              setStep('edit');
            }}
          />
        ) : null;
      case 'edit': {
        const m = editingMedia;
        if (!m) return null;
        const isVideo = m.contentType === 'video/mp4';
        return (
          <StoryEditStage
            media={m}
            onBack={() => setStep(isVideo ? 'video' : 'crop')}
            onClose={closeAndReset}
            onComplete={(items) => submit(m, items)}
          />
        );
      }
      case 'video':
        return video ? (
          <VideoStage
            key={video.file.name}
            file={video.file}
            dimensions={video.dimensions}
            duration={video.duration}
            onBack={() => {
              setVideo(null);
              setStep('select');
            }}
            onComplete={(prepared: VideoMedia) => {
              setEditingMedia(prepared);
              setStep('edit');
            }}
          />
        ) : null;
      case 'upload':
        if (create.error) {
          return (
            <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
              <p className="text-sm font-medium">We couldn't share your story</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Something went wrong while uploading. Please try again.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('select')}>
                  Back
                </Button>
                <Button onClick={() => pending && create.submit(pending)}>
                  Try again
                </Button>
              </div>
            </div>
          );
        }
        {
          const pct = create.phase === 'publishing' ? 100 : create.progress;
          const label = create.phase === 'publishing' ? 'Publishing…' : 'Uploading…';
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
      case 'done':
        return (
          <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
            <CheckCircle2 className="size-14 text-primary" strokeWidth={1.5} />
            <div>
              <p className="font-heading text-lg font-semibold">Story shared!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your story is live for 24 hours.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={closeAndReset}>
                Close
              </Button>
              <Button onClick={handleViewStory}>View story</Button>
            </div>
          </div>
        );
    }
  };

  const isEdit = step === 'edit';

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeAndReset();
      }}
    >
      <DialogContent
        showClose={!isEdit}
        onEscapeKeyDown={(e) => {
          // On the edit step the inline text/emoji overlays own ESC — don't let Radix close
          // the whole composer out from under them. (Close via the editor's own X.)
          if (isEdit) e.preventDefault();
        }}
        className={cn(
          'flex w-full max-w-none flex-col gap-0 rounded-none p-0',
          isEdit
            ? // Full-bleed black surface so the editor's content zone matches the viewer exactly.
              'h-[100dvh] max-h-[100dvh] bg-black'
            : 'h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl',
        )}
      >
        {isEdit ? (
          <>
            {/* No title bar on edit (it would shrink/offset the content zone vs the viewer);
                a hidden title keeps the dialog accessible. */}
            <DialogTitle className="sr-only">Edit story</DialogTitle>
            <div className="flex-1 overflow-hidden">{renderStep()}</div>
          </>
        ) : (
          <>
            <div className="flex h-12 shrink-0 items-center justify-center border-b px-12">
              <DialogTitle className="text-base">{STEP_TITLE[step]}</DialogTitle>
            </div>
            <div className="flex-1 overflow-y-auto">{renderStep()}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
