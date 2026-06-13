import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  clearMessageFailed,
  insertOptimisticMessage,
  markMessageFailed,
  messageExists,
  swapTempMessage,
} from '@/lib/messageCache';
import { patchConversationOnNewMessage } from '@/lib/conversationCache';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/types/api';

interface SendMessageVars {
  content: string;
  // When present, this is a RETRY of a previously-failed message: reuse its temp id instead of
  // inserting a new optimistic bubble (Phase 5.2 T7).
  retryTempId?: string;
}

interface SendMessageContext {
  tempId: string | null; // optimistic id (null when not authenticated)
}

// Send a TEXT message with an optimistic insert (mirrors useCreateComment). On success the temp
// is swapped for the server's real one in place; on FAILURE the optimistic message is kept and
// marked `failed` (NOT rolled back) so the user can tap to retry (T7 / Messenger pattern).
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  return useMutation<Message, Error, SendMessageVars, SendMessageContext>({
    mutationFn: ({ content }) =>
      conversationsApi.sendMessage(conversationId, { contentType: 'TEXT', content }),

    onMutate: async ({ content, retryTempId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.messages(conversationId) });

      // Retry: clear the failed flag on the existing bubble (back to the pending/spinner state).
      if (retryTempId) {
        clearMessageFailed(qc, conversationId, retryTempId);
        return { tempId: retryTempId };
      }

      // Normal send: insert a fresh optimistic message.
      let tempId: string | null = null;
      if (me) {
        tempId = `temp-${crypto.randomUUID()}`;
        const optimistic: Message = {
          id: tempId,
          conversationId,
          senderId: me.id,
          contentType: 'TEXT',
          content,
          createdAt: new Date().toISOString(),
          sender: me,
          reactions: [],
        };
        insertOptimisticMessage(qc, conversationId, optimistic);
      }
      return { tempId };
    },

    onError: (_err, _vars, ctx) => {
      // T7: do NOT roll back. Keep the message on screen, marked failed, so it can be retried.
      if (ctx?.tempId) markMessageFailed(qc, conversationId, ctx.tempId);
    },

    onSuccess: (data, _vars, ctx) => {
      // Swap the temp message for the server's real one. If the temp wasn't swapped, the socket
      // echo (message:new) may have already reconciled it — only refetch when the real message
      // genuinely isn't in cache.
      const swapped = ctx?.tempId ? swapTempMessage(qc, conversationId, ctx.tempId, data) : false;
      if (!swapped && !messageExists(qc, conversationId, data.id)) {
        qc.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      }
      // Patch the conversation list directly (D5: replaces invalidate-on-send) — move-to-top +
      // preview. Idempotent with the socket echo's identical patch, and keeps the list correct
      // even if the socket is down.
      patchConversationOnNewMessage(qc, conversationId, data);
    },
  });
}
