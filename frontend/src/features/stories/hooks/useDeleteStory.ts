import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storiesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  removeStoryFromCaches,
  restoreStoryCaches,
  snapshotStoryCaches,
  type StoryCacheSnapshot,
} from '@/lib/storyCache';

interface DeleteVars {
  storyId: string;
  username: string; // author's username — which userStories cache to patch
}

// Delete own story (DELETE /stories/:id). Optimistically removes it from both
// caches (dropping an emptied feed group); rolls back on error.
export function useDeleteStory() {
  const qc = useQueryClient();

  const mutation = useMutation<void, Error, DeleteVars, StoryCacheSnapshot>({
    mutationFn: ({ storyId }) => storiesApi.remove(storyId),

    onMutate: async ({ storyId, username }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: queryKeys.storiesFeed() }),
        qc.cancelQueries({ queryKey: queryKeys.userStories(username) }),
        qc.cancelQueries({ queryKey: queryKeys.archivedStories() }),
      ]);
      const snapshot = snapshotStoryCaches(qc, username);
      removeStoryFromCaches(qc, username, storyId);
      return snapshot;
    },

    onError: (_err, _vars, snapshot) => {
      if (snapshot) restoreStoryCaches(qc, snapshot);
    },
  });

  return { remove: mutation.mutate, isPending: mutation.isPending };
}
