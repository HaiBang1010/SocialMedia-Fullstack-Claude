import { useQuery } from '@tanstack/react-query';
import { postsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Single post (GET /posts/:id). `enabled` guards an empty id (e.g. before a
// route param resolves). Private/followers + non-owner surfaces as a 404 error.
export function usePost(id: string) {
  return useQuery({
    queryKey: queryKeys.post(id),
    queryFn: () => postsApi.getById(id),
    enabled: Boolean(id),
  });
}
