import { useQuery } from '@tanstack/react-query';
import { usersApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Suggestion list for the group-create modal (Phase 5.5): recent conversation partners + mutual
// followers, merged server-side. Keyed by the (debounced) search term; only runs while the modal
// is open. The caller debounces `q` before passing it in.
export function useGroupable(q: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.groupableUsers(q),
    queryFn: () => usersApi.getGroupable(q || undefined),
    enabled,
    staleTime: 30_000,
  });
}
