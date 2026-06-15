import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import type { Conversation, CreateGroupInput } from '@/types/api';

// Create a GROUP conversation, then navigate to it. Mirrors useStartDirectConversation: seed the
// single-conversation cache, invalidate the list (so the new group appears at the top), navigate.
export function useCreateGroup() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  return useMutation<Conversation, Error, CreateGroupInput>({
    mutationFn: (input) => conversationsApi.createGroup(input),
    onSuccess: (convo) => {
      qc.setQueryData(queryKeys.conversation(convo.id), convo);
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
      navigate(`/messages/${convo.id}`);
    },
  });
}
