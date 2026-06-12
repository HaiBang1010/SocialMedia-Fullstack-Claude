import { useQuery } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';

// One conversation (GET /conversations/:id) — drives the detail header. Enabled only with an id.
export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? ''),
    queryFn: () => conversationsApi.get(id!),
    enabled: !!id,
  });
}
