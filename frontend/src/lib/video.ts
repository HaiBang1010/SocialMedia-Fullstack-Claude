// Client-side video validation + metadata probing + poster extraction for the
// post composer. Mirrors lib/image.ts. A video is single-media-only (no carousel,
// no crop): we upload the original MP4 untouched and a JPEG poster we extract
// here with a <video> + <canvas> (no transcode in this phase).

import type { ImageDimensions } from './image';

// Only MP4/H.264 — universally playable in <video>. Keep in sync with the backend
// presignRequestSchema enum + EXT_BY_MIME.
export const VIDEO_MIME = ['video/mp4'] as const;
export type VideoMime = (typeof VIDEO_MIME)[number];

// 50 MB, matching the backend video `size` cap (images stay at 10MB).
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

// Longest poster width — keeps the thumbnail small (same ceiling as cropImage).
const THUMB_MAX_WIDTH = 1080;

const VIDEO_MIME_SET = new Set<string>(VIDEO_MIME);

// The prepared video payload handed to useCreatePost: the original file plus the
// extracted poster. width/height/duration come from the video's intrinsic track.
export interface VideoMedia {
  blob: Blob; // the original video file, uploaded untouched
  thumbnailBlob: Blob; // extracted poster (first-frame JPEG)
  contentType: VideoMime; // 'video/mp4'
  thumbnailContentType: 'image/jpeg';
  width: number;
  height: number;
  duration: number; // seconds
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number; // seconds
}

// Returns an English error message when the file is not a valid video upload, or
// null when it passes. Run this in the picker BEFORE any presign call.
export function validateVideoFile(file: File): string | null {
  if (!VIDEO_MIME_SET.has(file.type)) {
    return 'Unsupported video type. Use MP4 (H.264).';
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return 'Video is too large (max 50MB).';
  }
  return null;
}

export function isVideoFile(file: File): boolean {
  return VIDEO_MIME_SET.has(file.type);
}

// Load a muted, inline <video> from a file's object URL and resolve once metadata
// is known. Caller is responsible for calling the returned cleanup().
function loadVideo(
  file: File,
): Promise<{ video: HTMLVideoElement; url: string; cleanup: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = () => resolve({ video, url, cleanup });
    video.onerror = () => {
      cleanup();
      reject(new Error('Could not read the video.'));
    };
    video.src = url;
  });
}

// Read a video's intrinsic dimensions + duration (parallels getImageDimensions).
export async function getVideoMetadata(file: File): Promise<VideoMetadata> {
  const { video, cleanup } = await loadVideo(file);
  try {
    return {
      width: video.videoWidth,
      height: video.videoHeight,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
    };
  } finally {
    cleanup();
  }
}

// Grab a poster frame near the start (0.1s in, avoiding a black frame-0) and
// encode it as JPEG. Drawn from the LOCAL object URL, so there is no CORS issue.
export async function extractVideoThumbnail(file: File): Promise<Blob> {
  const { video, cleanup } = await loadVideo(file);
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const draw = () => {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) {
          reject(new Error('Could not read the video frame.'));
          return;
        }
        const outWidth = Math.min(vw, THUMB_MAX_WIDTH);
        const outHeight = Math.max(1, Math.round((outWidth * vh) / vw));

        const canvas = document.createElement('canvas');
        canvas.width = outWidth;
        canvas.height = outHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(video, 0, 0, outWidth, outHeight);
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new Error('Failed to encode the poster.')),
          'image/jpeg',
          0.9,
        );
      };

      video.onseeked = draw;
      video.onerror = () => reject(new Error('Could not read the video.'));
      // Seek a touch past the start; clamp for very short clips.
      const target = Math.min(0.1, (video.duration || 0) / 2);
      video.currentTime = target;
    });
    return blob;
  } finally {
    cleanup();
  }
}

// Build the upload-ready payload from a file + already-known metadata + poster.
export function buildVideoMedia(
  file: File,
  metadata: VideoMetadata,
  thumbnailBlob: Blob,
): VideoMedia {
  return {
    blob: file,
    thumbnailBlob,
    contentType: 'video/mp4',
    thumbnailContentType: 'image/jpeg',
    width: metadata.width,
    height: metadata.height,
    duration: metadata.duration,
  };
}

// Re-export for ComposerVideo dimension typing.
export type { ImageDimensions };
