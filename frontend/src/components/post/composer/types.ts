import type { CroppedImage } from '@/lib/cropImage';
import type { ImageDimensions } from '@/lib/image';
import type { VideoMedia } from '@/lib/video';

// One image inside the composer, progressing selected → cropped. Shared by the
// container (PostComposerModal), SelectStage, ImageStrip and CaptionStage.
export interface ComposerImage {
  id: string; // crypto.randomUUID — stable key for strip remove/reorder
  file: File;
  dimensions: ImageDimensions;
  isPassthrough: boolean; // GIF/AVIF — uploaded untouched, never in a carousel
  cropped: CroppedImage | null; // set once it passes through CropStage
}

// The single video inside the composer (Phase 3.2), progressing selected →
// prepared (poster extracted in VideoStage). Video is single-media-only, so the
// container holds one, not an array.
export interface ComposerVideo {
  id: string; // crypto.randomUUID — re-keys VideoStage between picks
  file: File;
  dimensions: ImageDimensions; // intrinsic video dimensions
  duration: number; // seconds
  prepared: VideoMedia | null; // set once VideoStage extracts the poster
}

// Carousel cap — mirrors the backend `createPostSchema.media.max(5)`.
export const MAX_IMAGES = 5;
