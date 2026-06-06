import type { CroppedImage } from '@/lib/cropImage';
import type { ImageDimensions } from '@/lib/image';

// One image inside the composer, progressing selected → cropped. Shared by the
// container (PostComposerModal), SelectStage, ImageStrip and CaptionStage.
export interface ComposerImage {
  id: string; // crypto.randomUUID — stable key for strip remove/reorder
  file: File;
  dimensions: ImageDimensions;
  isPassthrough: boolean; // GIF/AVIF — uploaded untouched, never in a carousel
  cropped: CroppedImage | null; // set once it passes through CropStage
}

// Carousel cap — mirrors the backend `createPostSchema.media.max(5)`.
export const MAX_IMAGES = 5;
