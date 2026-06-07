import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '@/api';
import { patchPostInCaches } from '@/lib/postCache';
import type { Post, UpdatePostInput } from '@/types/api';

interface UpdateVars {
  postId: string;
  input: UpdatePostInput; // caption and/or visibility
}

// Update a post's caption / visibility (owner only). Not optimistic — changes are
// infrequent and the server returns the full updated Post, which we splice into
// every cache in place (detail + feed + profile grid) via patchPostInCaches. We
// deliberately do NOT invalidate the feed: refetching reshuffles it + loses
// scroll (same reason like/comment avoid it), and an owner's post never appears
// in their own feed anyway.
export function useUpdatePost() {
  const qc = useQueryClient();

  const mutation = useMutation<Post, Error, UpdateVars>({
    mutationFn: ({ postId, input }) => postsApi.update(postId, input),
    onSuccess: (updated) => {
      patchPostInCaches(qc, updated.id, () => updated);
    },
  });

  return {
    update: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
