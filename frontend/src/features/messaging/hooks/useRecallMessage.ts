import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { messagesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { patchMessageDeleted } from '@/lib/messageCache';
import type { Message, MessagesListResponse } from '@/types/api';

interface RecallContext {
  prev?: InfiniteData<MessagesListResponse>;
}

// Phase 5.5 — recall (soft-delete) own message. Optimistic: patch the thread to a "Message deleted"
// tombstone immediately; on error (e.g. 410 past the window) roll back. On success reconcile the
// conversation list, whose preview skips recalled messages server-side (skip-to-previous, Q3).
export function useRecallMessage(conversationId: string) {
  const qc = useQueryClient();

  return useMutation<Message, Error, string, RecallContext>({
    mutationFn: (messageId) => messagesApi.recallMessage(messageId),

    onMutate: async (messageId) => {
      await qc.cancelQueries({ queryKey: queryKeys.messages(conversationId) });
      const prev = qc.getQueryData<InfiniteData<MessagesListResponse>>(
        queryKeys.messages(conversationId),
      );
      patchMessageDeleted(qc, conversationId, messageId, new Date().toISOString());
      return { prev };
    },

    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.messages(conversationId), ctx.prev);
    },

    onSuccess: (data) => {
      patchMessageDeleted(qc, conversationId, data.id, data.deletedAt ?? new Date().toISOString());
      // The recalled message may have been the list preview → refetch so it skips to the previous.
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
    },
  });
}
