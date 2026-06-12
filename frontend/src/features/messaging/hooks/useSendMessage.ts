import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  insertOptimisticMessage,
  restoreMessages,
  snapshotMessages,
  swapTempMessage,
  type MessageCacheSnapshot,
} from '@/lib/messageCache';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/types/api';

interface SendMessageVars {
  content: string;
}

interface SendMessageContext {
  snapshot: MessageCacheSnapshot;
  tempId: string | null; // optimistic id (null when not authenticated)
}

// Send a TEXT message with an optimistic insert (mirrors useCreateComment). The optimistic
// message is prepended to the newest position; on success the temp is swapped for the real
// one in place (no flicker), then the conversation list is invalidated so it re-sorts and
// refreshes its last-message preview.
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  return useMutation<Message, Error, SendMessageVars, SendMessageContext>({
    mutationFn: ({ content }) =>
      conversationsApi.sendMessage(conversationId, { contentType: 'TEXT', content }),

    onMutate: async ({ content }) => {
      await qc.cancelQueries({ queryKey: queryKeys.messages(conversationId) });
      const snapshot = snapshotMessages(qc, conversationId);

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
        };
        insertOptimisticMessage(qc, conversationId, optimistic);
      }

      return { snapshot, tempId };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx) restoreMessages(qc, ctx.snapshot);
    },

    onSuccess: (data, _vars, ctx) => {
      // Swap the temp message for the server's real one; fall back to a refetch if the temp
      // was never inserted (e.g. the thread wasn't loaded when sending).
      const swapped = ctx?.tempId ? swapTempMessage(qc, conversationId, ctx.tempId, data) : false;
      if (!swapped) qc.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      // Re-sort the conversation list + refresh its last-message preview.
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
    },
  });
}
