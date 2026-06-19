import { useQuery } from '@tanstack/react-query';
import { musicApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// Track search for the Music Story picker (GET /music/search). The caller debounces the
// query before passing it in; `enabled` gates the request to a non-empty query. `select`
// unwraps to the tracks array. Results are stable for 5 min (the catalog doesn't move).
export function useSearchMusic(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: queryKeys.musicSearch(query),
    queryFn: () => musicApi.search(query),
    select: (res) => res.items,
    enabled: query.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
