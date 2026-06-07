import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi, postsApi, uploadToPresignedUrl } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import type { CroppedImage } from '@/lib/cropImage';
import type { VideoMedia } from '@/lib/video';
import type { MediaInput, Post, PostVisibility } from '@/types/api';

// Which leg of the flow we are on — drives the UploadStage label. Progress %
// only moves during 'uploading' (the S3 PUT); 'publishing' is the POST /posts.
export type CreatePostPhase = 'idle' | 'uploading' | 'publishing';

// A prepared media item: a cropped image (Phase 3.1) or a single video + its
// poster (Phase 3.2). Discriminated by contentType ('video/mp4' is video-only).
export type MediaPayload = CroppedImage | VideoMedia;

function isVideoPayload(m: MediaPayload): m is VideoMedia {
  return m.contentType === 'video/mp4';
}

export interface CreatePostPayload {
  caption?: string;
  visibility: PostVisibility;
  // Prepared media in the user's order. Either up to 5 images (carousel) or a
  // single video; omit / empty for a caption-only post.
  media?: MediaPayload[];
}

// Create a post end-to-end: for each item presign → PUT the blob to S3 (with
// progress) → then POST /posts with the ordered media[]. There is no optimistic
// cache write to roll back — a brand-new post has no real id/url until the
// server responds, and reconciling a temp id inside a cursor-paginated grid is
// the exact fragility useCreateComment avoids.
//
// Uploads run SEQUENTIALLY (not Promise.all): progress aggregation into the
// single bar is exact, and a failure points at one known item. A video item is
// two PUTs (the video, then its poster) merged into one MediaInput; it weights
// 90% video / 10% poster inside the item. Order of the resulting media[] follows
// the user's order, so the backend assigns `order` 0..N-1 to match. Note: a
// failure after k successful PUTs leaves orphan S3 objects — accepted as
// Phase-polish debt; retry re-uploads everything with fresh keys.
//
// On success we seed the detail cache (so "View post" is instant) and invalidate
// the author's own profile grid. We deliberately do NOT touch the feed: the feed
// only contains posts by people you follow (you never follow yourself), so a new
// post of yours never belongs there — refetching it would just cost scroll.
export function useCreatePost() {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<CreatePostPhase>('idle');
  // 1-based index of the item currently uploading + total, so UploadStage can
  // show "Uploading 2/5…". Both 0 outside the uploading leg.
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);

  const mutation = useMutation<Post, Error, CreatePostPayload>({
    mutationFn: async ({ caption, visibility, media }) => {
      let mediaInput: MediaInput[] | undefined;

      if (media && media.length > 0) {
        setPhase('uploading');
        setProgress(0);
        setUploadTotal(media.length);

        const n = media.length;
        const uploaded: MediaInput[] = [];

        for (let i = 0; i < n; i++) {
          const item = media[i];
          setUploadIndex(i + 1);

          // Map this item's local 0..100 progress onto the aggregate bar; item i
          // occupies the [i/n, (i+1)/n] slice.
          const setItemProgress = (itemPct: number) =>
            setProgress(Math.round(((i + itemPct / 100) / n) * 100));

          if (isVideoPayload(item)) {
            // 1) Video file (untouched). Weighs 90% of the item.
            const videoPresign = await mediaApi.presign({
              contentType: item.contentType,
              size: item.blob.size,
            });
            const videoFile = new File([item.blob], 'upload', {
              type: item.contentType,
            });
            await uploadToPresignedUrl(videoPresign.uploadUrl, videoFile, (p) =>
              setItemProgress(p * 0.9),
            );

            // 2) Poster (JPEG). Weighs the remaining 10%.
            const thumbPresign = await mediaApi.presign({
              contentType: item.thumbnailContentType,
              size: item.thumbnailBlob.size,
            });
            const thumbFile = new File([item.thumbnailBlob], 'poster', {
              type: item.thumbnailContentType,
            });
            await uploadToPresignedUrl(thumbPresign.uploadUrl, thumbFile, (p) =>
              setItemProgress(90 + p * 0.1),
            );

            uploaded.push({
              type: 'VIDEO',
              url: videoPresign.publicUrl,
              objectKey: videoPresign.objectKey,
              thumbnailUrl: thumbPresign.publicUrl,
              thumbnailObjectKey: thumbPresign.objectKey,
              duration: Math.round(item.duration),
              width: item.width,
              height: item.height,
            });
          } else {
            // Image: one presign + one PUT. contentType signed here MUST equal
            // the blob's type (and the PUT Content-Type) or S3 rejects the
            // signature. Crops are jpeg/webp.
            const presign = await mediaApi.presign({
              contentType: item.contentType,
              size: item.blob.size,
            });
            const file = new File([item.blob], 'upload', {
              type: item.contentType,
            });
            await uploadToPresignedUrl(presign.uploadUrl, file, setItemProgress);

            uploaded.push({
              url: presign.publicUrl,
              objectKey: presign.objectKey,
              width: item.width,
              height: item.height,
            });
          }
        }

        mediaInput = uploaded;
      }

      setPhase('publishing');
      const trimmed = caption?.trim();
      return postsApi.create({
        caption: trimmed ? trimmed : undefined,
        visibility,
        media: mediaInput,
      });
    },

    onSuccess: (post) => {
      qc.setQueryData(queryKeys.post(post.id), post);
      if (me) {
        qc.invalidateQueries({ queryKey: queryKeys.userPosts(me.username) });
      }
    },
  });

  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    error: mutation.error,
    createdPost: mutation.data,
    progress,
    phase,
    uploadIndex,
    uploadTotal,
    reset: () => {
      mutation.reset();
      setProgress(0);
      setPhase('idle');
      setUploadIndex(0);
      setUploadTotal(0);
    },
  };
}
