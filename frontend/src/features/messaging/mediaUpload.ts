// Phase 5.4a — preparing + uploading message attachments (images + videos, mix allowed).
//
// Flow: MessageInput prepares each picked File (probe dimensions / extract a thumbnail / make
// a preview object URL), stashes the prepared list keyed by the optimistic temp-id, then fires
// useSendMessage. The send hook reads the stash, runs uploadAttachments (pool of 3 — D3), and
// POSTs the resulting MessageMediaInput[]. Each media item is TWO uploads: the original
// (untouched) + a thumbnail/poster (Q6). Mirrors useCreateStory's presign→PUT pattern.

import { mediaApi, uploadToPresignedUrl } from '@/api';
import { getImageDimensions, validateMediaFile } from '@/lib/image';
import { makeImageThumbnail } from '@/lib/imageResize';
import {
  extractVideoThumbnail,
  getVideoMetadata,
  isVideoFile,
  validateVideoFile,
} from '@/lib/video';
import { runPool } from '@/lib/uploadPool';
import { VOICE_MIME } from '@/lib/audio';
import type { MessageMediaInput, PresignRequest } from '@/types/api';

export type UploadStatus = 'uploading' | 'done' | 'failed';

// A picked file made ready to upload + preview. `uploaded` is set once the PUT(s) succeed, so a
// retry can resume — re-uploading only the items that haven't finished yet. Voice has no
// thumbnail/dimensions (thumbnailBlob/width/height absent → single PUT).
export interface PreparedAttachment {
  localId: string;
  type: 'IMAGE' | 'VIDEO' | 'VOICE';
  file: File; // original, uploaded untouched
  fileContentType: PresignRequest['contentType'];
  thumbnailBlob?: Blob;
  thumbnailContentType?: PresignRequest['contentType'];
  width?: number;
  height?: number;
  duration?: number; // seconds, video + voice
  previewUrl: string; // object URL for the optimistic preview (image: original / video: poster / voice: clip)
  uploaded?: MessageMediaInput;
}

// Reject before any presign round-trip. Returns an English error or null when the file passes.
export function validateAttachment(file: File): string | null {
  return isVideoFile(file) ? validateVideoFile(file) : validateMediaFile(file);
}

// Probe + thumbnail a single file. Images: original dimensions + a small JPEG thumbnail (falls
// back to the original blob if the canvas can't decode it, e.g. some AVIF). Videos: intrinsic
// dimensions/duration + a first-frame poster (lib/video.ts).
export async function prepareAttachment(file: File): Promise<PreparedAttachment> {
  const localId = `att-${crypto.randomUUID()}`;

  if (isVideoFile(file)) {
    const meta = await getVideoMetadata(file);
    const thumbnailBlob = await extractVideoThumbnail(file);
    return {
      localId,
      type: 'VIDEO',
      file,
      fileContentType: 'video/mp4',
      thumbnailBlob,
      thumbnailContentType: 'image/jpeg',
      width: meta.width,
      height: meta.height,
      duration: meta.duration,
      previewUrl: URL.createObjectURL(thumbnailBlob), // poster previews in an <img>
    };
  }

  const dims = await getImageDimensions(file);
  const thumb = await makeImageThumbnail(file);
  return {
    localId,
    type: 'IMAGE',
    file,
    fileContentType: file.type as PresignRequest['contentType'],
    thumbnailBlob: thumb ?? file,
    thumbnailContentType: (thumb ? 'image/jpeg' : file.type) as PresignRequest['contentType'],
    width: dims.width,
    height: dims.height,
    previewUrl: URL.createObjectURL(file),
  };
}

// Build a prepared VOICE attachment from a recorded clip (Phase 5.4b). No thumbnail/dimensions —
// just the WebM blob + duration. previewUrl plays locally in the optimistic bubble (Q5).
export function prepareVoiceAttachment(blob: Blob, duration: number): PreparedAttachment {
  return {
    localId: `att-${crypto.randomUUID()}`,
    type: 'VOICE',
    file: new File([blob], 'voice.webm', { type: VOICE_MIME }),
    fileContentType: VOICE_MIME,
    duration,
    previewUrl: URL.createObjectURL(blob),
  };
}

// Upload all attachments with at most 3 in flight (D3). Each item: presign+PUT original (0–90%)
// then presign+PUT thumbnail (90–100%). `onItem` reports per-item progress/status (the send hook
// patches it into the optimistic message). A failed item marks itself 'failed' and re-throws so
// the batch rejects (the send is marked failed); already-finished items keep their `uploaded` ref
// for a resumable retry.
export async function uploadAttachments(
  attachments: PreparedAttachment[],
  onItem: (order: number, progress: number, status: UploadStatus) => void,
): Promise<MessageMediaInput[]> {
  return runPool(
    attachments,
    async (a, order) => {
      if (a.uploaded) {
        onItem(order, 100, 'done');
        return a.uploaded;
      }
      try {
        const hasThumb = !!a.thumbnailBlob;
        const orig = await mediaApi.presign({ contentType: a.fileContentType, size: a.file.size });
        await uploadToPresignedUrl(orig.uploadUrl, a.file, (p) =>
          onItem(order, Math.round(p * (hasThumb ? 0.9 : 1)), 'uploading'),
        );

        // Voice (no thumbnail) → single PUT. Image/video → second PUT for the thumbnail/poster.
        let thumbUrl: string | undefined;
        let thumbKey: string | undefined;
        if (a.thumbnailBlob) {
          const thumbFile = new File([a.thumbnailBlob], 'thumb', { type: a.thumbnailContentType });
          const thumb = await mediaApi.presign({
            contentType: a.thumbnailContentType!,
            size: thumbFile.size,
          });
          await uploadToPresignedUrl(thumb.uploadUrl, thumbFile, (p) =>
            onItem(order, 90 + Math.round(p * 0.1), 'uploading'),
          );
          thumbUrl = thumb.publicUrl;
          thumbKey = thumb.objectKey;
        }

        const input: MessageMediaInput = {
          type: a.type,
          order,
          url: orig.publicUrl,
          objectKey: orig.objectKey,
          ...(thumbUrl ? { thumbnailUrl: thumbUrl, thumbnailObjectKey: thumbKey } : {}),
          ...(a.width != null ? { width: a.width } : {}),
          ...(a.height != null ? { height: a.height } : {}),
          ...(a.type === 'VIDEO' || a.type === 'VOICE'
            ? { duration: Math.round(a.duration ?? 0) }
            : {}),
        };
        a.uploaded = input;
        onItem(order, 100, 'done');
        return input;
      } catch (err) {
        onItem(order, 0, 'failed');
        throw err;
      }
    },
    3,
  );
}

// ── Pending-attachments stash ──────────────────────────────────────────────
// Prepared attachments aren't serializable (they hold File/Blob), so they can't live in the
// query cache alongside the optimistic message. Keep them in a module map keyed by temp-id;
// the send hook reads them in onMutate (preview) + mutationFn (upload), and clears (revoking
// preview URLs) on success.

const pending = new Map<string, PreparedAttachment[]>();

export function setPendingAttachments(tempId: string, attachments: PreparedAttachment[]): void {
  pending.set(tempId, attachments);
}

export function getPendingAttachments(tempId: string): PreparedAttachment[] | undefined {
  return pending.get(tempId);
}

export function clearPendingAttachments(tempId: string): void {
  const attachments = pending.get(tempId);
  if (attachments) for (const a of attachments) URL.revokeObjectURL(a.previewUrl);
  pending.delete(tempId);
}
