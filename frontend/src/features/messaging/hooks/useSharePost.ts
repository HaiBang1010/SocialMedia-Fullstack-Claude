import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import { patchConversationOnNewMessage } from '@/lib/conversationCache';
import type { Message } from '@/types/api';

interface SharePostVars {
  conversationId: string;
  postId: string;
  content?: string;
}

/**
 * Phase 5.4c — share a post into a conversation (triggered from a PostCard's Share modal, not from
 * inside the thread). No in-thread optimistic insert: the sharer isn't viewing the target thread,
 * so we just send, then patch the conversation list (move-to-top + preview). When the thread is
 * next opened the message is fetched, and the socket `message:new` echo populates open threads.
 * The target conversation is chosen per-send, so this can't reuse the conversation-bound
 * useSendMessage hook.
 */
export function useSharePost() {
  const qc = useQueryClient();

  return useMutation<Message, Error, SharePostVars>({
    mutationFn: ({ conversationId, postId, content }) =>
      conversationsApi.sendMessage(conversationId, {
        sharedPostId: postId,
        content: content || undefined,
      }),
    onSuccess: (data, { conversationId }) => {
      patchConversationOnNewMessage(qc, conversationId, data);
      qc.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      // The post was shared from OUTSIDE the thread (the feed), so this client never joined the
      // convo room and misses the recipient's live `read-receipt:update` for it. Without this,
      // staleTime(30s) serves the stale read-cursor when the thread opens, so "Seen" never lands on
      // the shared post until a full reload. Invalidating the conversation detail forces a refetch
      // of fresh participant read-cursors on open. (In-thread sends don't need this — the sender is
      // already in the room and gets the receipt live.)
      qc.invalidateQueries({ queryKey: queryKeys.conversation(conversationId) });
    },
  });
}
