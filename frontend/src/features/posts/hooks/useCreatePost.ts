import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mediaApi, postsApi, uploadToPresignedUrl } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { useAuthStore } from '@/stores/authStore';
import type { CroppedImage } from '@/lib/cropImage';
import type { MediaInput, Post, PostVisibility } from '@/types/api';

// Which leg of the flow we are on — drives the UploadStage label. Progress %
// only moves during 'uploading' (the S3 PUT); 'publishing' is the POST /posts.
export type CreatePostPhase = 'idle' | 'uploading' | 'publishing';

export interface CreatePostPayload {
  caption?: string;
  visibility: PostVisibility;
  // Prepared media in the user's order (cropped or passthrough). A carousel may
  // carry up to 5 images; omit / empty for a caption-only post.
  media?: CroppedImage[];
}

// Create a post end-to-end: for each image presign → PUT the blob to S3 (with
// progress) → then POST /posts with the ordered media[]. There is no optimistic
// cache write to roll back — a brand-new post has no real id/url until the
// server responds, and reconciling a temp id inside a cursor-paginated grid is
// the exact fragility useCreateComment avoids.
//
// Uploads run SEQUENTIALLY (not Promise.all): progress aggregation into the
// single bar is exact, and a failure points at one known file. Order of the
// resulting media[] follows the user's order, so the backend assigns
// `order` 0..N-1 to match. Note: a failure after k successful PUTs leaves k
// orphan S3 objects (no DB row references them) — accepted as Phase-polish debt;
// retry re-uploads ALL images with fresh keys.
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
  // 1-based index of the image currently uploading + total, so UploadStage can
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
          const img = media[i];
          setUploadIndex(i + 1);

          // contentType signed here MUST equal the blob's type (and the PUT
          // Content-Type) or S3 rejects the signature. Read per-image: crops are
          // jpeg/webp, GIF/AVIF passthrough keep their original type.
          const presign = await mediaApi.presign({
            contentType: img.contentType,
            size: img.blob.size,
          });
          const file = new File([img.blob], 'upload', {
            type: img.contentType,
          });
          // File i contributes [i/n, (i+1)/n] of the aggregate bar.
          await uploadToPresignedUrl(presign.uploadUrl, file, (filePct) =>
            setProgress(Math.round(((i + filePct / 100) / n) * 100)),
          );

          uploaded.push({
            url: presign.publicUrl,
            objectKey: presign.objectKey,
            width: img.width,
            height: img.height,
          });
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
