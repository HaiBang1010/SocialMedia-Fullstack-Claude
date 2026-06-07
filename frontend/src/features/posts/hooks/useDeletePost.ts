import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  removePostFromLists,
  restorePostCaches,
  snapshotPostCaches,
  userPostsPredicate,
  type PostCacheSnapshot,
} from '@/lib/postCache';

interface DeleteVars {
  postId: string;
  authorUsername: string; // to invalidate that profile's postsCount on success
}

// Delete a post (owner only). Optimistically removes it from the feed + every
// userPosts list so the grid/feed update instantly; the single post(id) cache is
// left in place during the request so an open detail view doesn't flash
// "not found", then dropped on success. On error every list is restored from the
// snapshot. The profile's postsCount lives in the user(username) profile query,
// so we invalidate that (not userPosts, which we already patched) to re-tally it.
export function useDeletePost() {
  const qc = useQueryClient();

  const mutation = useMutation<void, Error, DeleteVars, PostCacheSnapshot>({
    mutationFn: ({ postId }) => postsApi.remove(postId),

    onMutate: async ({ postId }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: queryKeys.feed() }),
        qc.cancelQueries({ predicate: userPostsPredicate }),
        qc.cancelQueries({ queryKey: queryKeys.post(postId) }),
      ]);
      const snapshot = snapshotPostCaches(qc, postId);
      removePostFromLists(qc, postId);
      return snapshot;
    },

    onError: (_err, _vars, snapshot) => {
      if (snapshot) restorePostCaches(qc, snapshot);
    },

    onSuccess: (_data, { postId, authorUsername }) => {
      qc.removeQueries({ queryKey: queryKeys.post(postId) });
      qc.invalidateQueries({ queryKey: queryKeys.user(authorUsername) });
    },
  });

  return {
    remove: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}
