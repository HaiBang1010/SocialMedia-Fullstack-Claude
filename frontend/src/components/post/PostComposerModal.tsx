import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useComposerStore } from '@/stores/composerStore';
import { useCreatePost, type MediaPayload } from '@/features/posts/hooks/useCreatePost';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import type { CroppedImage } from '@/lib/cropImage';
import type { VideoMedia } from '@/lib/video';
import type { PostVisibility } from '@/types/api';
import type { ComposerImage, ComposerVideo } from './composer/types';
import SelectStage from './composer/SelectStage';
import CropStage from './composer/CropStage';
import VideoStage from './composer/VideoStage';
import CaptionStage from './composer/CaptionStage';
import UploadStage from './composer/UploadStage';
import DoneStage from './composer/DoneStage';

type Step = 'select' | 'crop' | 'video' | 'caption' | 'upload' | 'done';

const STEP_TITLE: Record<Step, string> = {
  select: 'New post',
  crop: 'Crop',
  video: 'Video',
  caption: 'Caption',
  upload: 'Sharing',
  done: 'Done',
};

// Global post-composer modal — a single instance mounted in AppLayout, driven by
// composerStore. Owns the state machine, which forks after Select:
//   image flow:  select → crop → caption → upload → done
//   video flow:  select → video → caption → upload → done
// The active flow is DERIVED (a video → 'video', any image → 'image', else null)
// so the two media holders can't drift out of sync. Image crop is a single
// CropStage driven by a cropIndex cursor (re-keyed per image); a video is
// single-media-only with no crop / aspect lock. Stages create + revoke their own
// preview object URLs, so closing the dialog cleans them up.
export default function PostComposerModal() {
  const isOpen = useComposerStore((s) => s.isOpen);
  const close = useComposerStore((s) => s.close);
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const create = useCreatePost();

  const [step, setStep] = useState<Step>('select');
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [video, setVideo] = useState<ComposerVideo | null>(null);
  const [cropIndex, setCropIndex] = useState(0);
  const [ratio, setRatio] = useState(1); // SHARED aspect ratio, chosen once
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<PostVisibility>('PUBLIC');

  // Single source of truth for which flow is active.
  const flow: 'image' | 'video' | null = video
    ? 'video'
    : images.length > 0
      ? 'image'
      : null;

  // Locked once any image has been cropped — images 2..N inherit the ratio.
  const ratioLocked = images.some((i) => i.cropped !== null);

  const resetAll = () => {
    setStep('select');
    setImages([]);
    setVideo(null);
    setCropIndex(0);
    setRatio(1);
    setCaption('');
    setVisibility('PUBLIC');
    create.reset();
  };

  const closeAndReset = () => {
    close();
    resetAll();
  };

  // Step 4 → 5 once the mutation resolves.
  useEffect(() => {
    if (create.isSuccess && step === 'upload') setStep('done');
  }, [create.isSuccess, step]);

  // ── Select ──
  const handleAdd = (added: ComposerImage[]) =>
    setImages((prev) => [...prev, ...added]);

  const handleRemove = (id: string) => {
    const next = images.filter((i) => i.id !== id);
    setImages(next);
    if (next.length === 0) {
      setCropIndex(0);
      setStep('select'); // composer always needs ≥1 media
      return;
    }
    if (cropIndex >= next.length) setCropIndex(next.length - 1);
  };

  const handleReorder = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setImages(next);
  };

  const handlePickVideo = (picked: ComposerVideo) => setVideo(picked);
  const handleClearVideo = () => {
    setVideo(null);
    setStep('select');
  };

  // Select "Next" routes by flow.
  const handleSelectNext = () => {
    if (flow === 'video') {
      setStep('video');
      return;
    }
    goToCrop();
  };

  // Enter the crop loop at the first un-cropped image (so adding photos later
  // only crops the new ones); skip straight to caption when all are cropped.
  const goToCrop = () => {
    const idx = images.findIndex((i) => i.cropped === null);
    if (idx === -1) {
      setStep('caption');
      return;
    }
    setCropIndex(idx);
    setStep('crop');
  };

  // ── Crop (image) ──
  const handleCropped = (prepared: CroppedImage) => {
    const next = images.map((img, i) =>
      i === cropIndex ? { ...img, cropped: prepared } : img,
    );
    setImages(next);
    const idx = next.findIndex((i) => i.cropped === null);
    if (idx === -1) setStep('caption');
    else setCropIndex(idx);
  };

  const handleCropBack = () => {
    if (cropIndex > 0) setCropIndex(cropIndex - 1);
    else setStep('select');
  };

  // ── Video ──
  const handleVideoPrepared = (prepared: VideoMedia) => {
    setVideo((prev) => (prev ? { ...prev, prepared } : prev));
    setStep('caption');
  };

  // ── Caption → submit ──
  const handleCaptionBack = () =>
    setStep(flow === 'video' ? 'video' : 'crop');

  const submitPost = () => {
    let media: MediaPayload[];
    if (flow === 'video') {
      media = video?.prepared ? [video.prepared] : [];
    } else {
      media = images
        .map((i) => i.cropped)
        .filter((c): c is CroppedImage => c !== null);
    }
    if (media.length === 0) return;
    create.submit({ caption, visibility, media });
  };

  const handleShare = () => {
    setStep('upload');
    submitPost();
  };

  const handleViewPost = () => {
    const id = create.createdPost?.id;
    closeAndReset();
    if (id) {
      navigate(`/posts/${id}`, {
        state: isDesktop ? { background: location } : undefined,
      });
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'select':
        return (
          <SelectStage
            flow={flow}
            images={images}
            video={video}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onReorder={handleReorder}
            onPickVideo={handlePickVideo}
            onClearVideo={handleClearVideo}
            onNext={handleSelectNext}
          />
        );
      case 'crop': {
        const current = images[cropIndex];
        return current ? (
          <CropStage
            key={current.id}
            file={current.file}
            dimensions={current.dimensions}
            isPassthrough={current.isPassthrough}
            ratio={ratio}
            onRatioChange={setRatio}
            ratioLocked={ratioLocked}
            onBack={handleCropBack}
            onComplete={handleCropped}
          />
        ) : null;
      }
      case 'video':
        return video ? (
          <VideoStage
            key={video.id}
            file={video.file}
            dimensions={video.dimensions}
            duration={video.duration}
            onBack={handleClearVideo}
            onComplete={handleVideoPrepared}
          />
        ) : null;
      case 'caption':
        return flow ? (
          <CaptionStage
            images={images}
            video={video}
            caption={caption}
            visibility={visibility}
            onCaptionChange={setCaption}
            onVisibilityChange={setVisibility}
            onRemove={handleRemove}
            onReorder={handleReorder}
            onBack={handleCaptionBack}
            onShare={handleShare}
          />
        ) : null;
      case 'upload':
        return (
          <UploadStage
            mediaKind={flow ?? 'image'}
            phase={create.phase}
            progress={create.progress}
            uploadIndex={create.uploadIndex}
            uploadTotal={create.uploadTotal}
            error={create.error}
            onRetry={submitPost}
            onBack={() => setStep('caption')}
          />
        );
      case 'done':
        return <DoneStage onViewPost={handleViewPost} onClose={closeAndReset} />;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) closeAndReset();
      }}
    >
      <DialogContent
        showClose
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl"
      >
        <div className="flex h-12 shrink-0 items-center justify-center border-b px-12">
          <DialogTitle className="text-base">
            {STEP_TITLE[step]}
            {step === 'crop' && images.length > 1 && (
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                {cropIndex + 1}/{images.length}
              </span>
            )}
          </DialogTitle>
        </div>
        <div className="flex-1 overflow-y-auto">{renderStep()}</div>
      </DialogContent>
    </Dialog>
  );
}
