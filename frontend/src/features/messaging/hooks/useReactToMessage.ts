import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { messagesApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { patchMessageReactions } from '@/lib/messageCache';
import { useAuthStore } from '@/stores/authStore';
import type { Message, MessagesListResponse } from '@/types/api';

interface ReactVars {
  messageId: string;
  emoji: string | null; // null = remove my reaction
}

interface ReactContext {
  prev?: InfiniteData<MessagesListResponse>;
}

// Phase 5.3a — react to a message with an optimistic local patch. The reaction is keyed on the
// current user (one per user), so optimism just removes my prior entry and adds the new emoji (or
// nothing, when removing). onSuccess reconciles with the server's authoritative reactions —
// idempotent with the socket echo that also lands via useGlobalSocketEvents.
export function useReactToMessage(conversationId: string) {
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id);

  const mutation = useMutation<Message, Error, ReactVars, ReactContext>({
    mutationFn: ({ messageId, emoji }) =>
      emoji === null ? messagesApi.removeReaction(messageId) : messagesApi.reactToMessage(messageId, emoji),

    onMutate: async ({ messageId, emoji }) => {
      await qc.cancelQueries({ queryKey: queryKeys.messages(conversationId) });
      const prev = qc.getQueryData<InfiniteData<MessagesListResponse>>(queryKeys.messages(conversationId));
      if (meId) {
        patchMessageReactions(qc, conversationId, messageId, (cur) => {
          const filtered = cur.filter((r) => r.userId !== meId);
          return emoji === null ? filtered : [...filtered, { userId: meId, emoji }];
        });
      }
      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.messages(conversationId), ctx.prev);
    },

    onSuccess: (data) => {
      patchMessageReactions(qc, conversationId, data.id, () => data.reactions);
    },
  });

  /**
   * Toggle a reaction from the picker or a chip: tapping the emoji you already have removes it;
   * any other emoji sets/replaces yours. `currentMyEmoji` is the user's existing reaction (or
   * undefined) on this message.
   */
  const toggle = (messageId: string, currentMyEmoji: string | undefined, tappedEmoji: string) => {
    mutation.mutate({ messageId, emoji: currentMyEmoji === tappedEmoji ? null : tappedEmoji });
  };

  return { toggle, isPending: mutation.isPending };
}
