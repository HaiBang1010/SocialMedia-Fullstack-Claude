// Phase 5.2 — direct cache patches that replace invalidate-on-send (D5) and apply realtime
// socket events without refetching. The conversation LIST is InfiniteData<ConversationListResponse>;
// the single conversation (queryKeys.conversation(id)) is a plain Conversation.

import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Conversation, ConversationListResponse, Message } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Apply a new (sent or received) message to the conversation list: update the conversation's
 * lastMessage + lastMessageAt and move it to the very top (most-recent-first). Idempotent — safe
 * to call from both the sender's onSuccess and the socket echo. Falls back to invalidating the
 * list when the conversation isn't in cache (e.g. a brand-new conversation started by someone
 * else) so it gets fetched fresh.
 */
export function patchConversationOnNewMessage(
  qc: QueryClient,
  conversationId: string,
  message: Message,
): void {
  let found = false;

  qc.setQueryData<InfiniteData<ConversationListResponse>>(queryKeys.conversations(), (data) => {
    if (!data || data.pages.length === 0) return data;

    let target: Conversation | undefined;
    const stripped = data.pages.map((page) => {
      const idx = page.conversations.findIndex((c) => c.id === conversationId);
      if (idx === -1) return page;
      target = page.conversations[idx];
      found = true;
      return { ...page, conversations: page.conversations.filter((c) => c.id !== conversationId) };
    });
    if (!target) return data;

    const updated: Conversation = { ...target, lastMessage: message, lastMessageAt: message.createdAt };
    const [first, ...rest] = stripped;
    return {
      ...data,
      pages: [{ ...first, conversations: [updated, ...first.conversations] }, ...rest],
    };
  });

  // Keep the single-conversation cache (detail header preview) in step when present.
  qc.setQueryData<Conversation>(queryKeys.conversation(conversationId), (c) =>
    c ? { ...c, lastMessage: message, lastMessageAt: message.createdAt } : c,
  );

  // Not in the list cache → fetch it fresh (or no-op if the list isn't mounted).
  if (!found) {
    qc.invalidateQueries({ queryKey: queryKeys.conversations() });
  }
}

/**
 * Apply a read receipt: set the given participant's lastReadMessageId on the single conversation
 * cache, which drives the "Seen" indicator in the open thread.
 */
export function patchReadReceipt(
  qc: QueryClient,
  conversationId: string,
  userId: string,
  lastReadMessageId: string,
): void {
  qc.setQueryData<Conversation>(queryKeys.conversation(conversationId), (c) => {
    if (!c) return c;
    let changed = false;
    const participants = c.participants.map((p) => {
      if (p.user.id !== userId || p.lastReadMessageId === lastReadMessageId) return p;
      changed = true;
      return { ...p, lastReadMessageId };
    });
    return changed ? { ...c, participants } : c;
  });
}
