import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import type { SearchType } from '@/types/api';

// Full-text search (GET /search). Disabled until the (debounced) query is non-empty. Keyed by
// query + type so switching tabs / typing produces cached, deduped results.
export function useSearch(q: string, type: SearchType = 'all') {
  return useQuery({
    queryKey: queryKeys.search(q, type),
    queryFn: () => searchApi.search(q, type),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
}
