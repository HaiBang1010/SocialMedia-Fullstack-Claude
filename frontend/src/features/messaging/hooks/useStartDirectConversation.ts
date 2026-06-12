import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Conversation, CreateDirectInput } from '@/types/api';

// Start (or reuse) a 1-1 conversation, then navigate to it. The backend upsert on directKey
// makes this idempotent, so a double-click lands on the same conversation. The caller also
// disables its trigger while pending as a first line of defense against the double request.
export function useStartDirectConversation() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation<Conversation, Error, CreateDirectInput>({
    mutationFn: (input) => conversationsApi.createDirect(input),
    onSuccess: (convo) => {
      qc.setQueryData(queryKeys.conversation(convo.id), convo);
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
      navigate(`/messages/${convo.id}`);
    },
  });
}
