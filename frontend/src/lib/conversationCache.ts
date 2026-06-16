// Phase 5.2 — direct cache patches that replace invalidate-on-send (D5) and apply realtime
// socket events without refetching. The conversation LIST is InfiniteData<ConversationListResponse>;
// the single conversation (queryKeys.conversation(id)) is a plain Conversation.

import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type {
  Conversation,
  ConversationListResponse,
  Message,
  UnreadTotalResponse,
} from '@/types/api';
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
 * Phase 7 — bump a conversation's unread badge by one (a new message arrived in a conversation the
 * viewer is NOT currently looking at). Patches the list item (if loaded) + the global total cache.
 * Monotonic +1 on the total is always correct for a fresh incoming message.
 */
export function incrementConversationUnread(qc: QueryClient, conversationId: string): void {
  qc.setQueryData<InfiniteData<ConversationListResponse>>(queryKeys.conversations(), (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        conversations: page.conversations.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: c.unreadCount + 1 } : c,
        ),
      })),
    };
  });
  qc.setQueryData<UnreadTotalResponse>(queryKeys.conversationsUnreadTotal(), (t) =>
    t ? { total: t.total + 1 } : t,
  );
}

/**
 * Phase 7 — clear a conversation's unread badge (the viewer opened/read it). Sets the list item's
 * unreadCount to 0 and decrements the global total by that same amount — both LOCALLY, no refetch.
 *
 * Decrementing locally (vs invalidating the total) is what fixes the active-conversation race: a
 * refetch of /conversations/unread-total can beat the `message:read` socket write to the server, so
 * the server still counts the just-arrived message and the badge bounces to +1. The per-conversation
 * delta is known from the list cache, so no server round-trip is needed. Only when the conversation
 * isn't in the loaded list (e.g. a chat opened directly on mobile) do we fall back to invalidation.
 */
export function resetConversationUnread(qc: QueryClient, conversationId: string): void {
  let prev = 0;
  let foundInList = false;

  qc.setQueryData<InfiniteData<ConversationListResponse>>(queryKeys.conversations(), (data) => {
    if (!data) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        conversations: page.conversations.map((c) => {
          if (c.id !== conversationId) return c;
          foundInList = true;
          if (c.unreadCount === 0) return c;
          prev = c.unreadCount;
          return { ...c, unreadCount: 0 };
        }),
      })),
    };
  });

  if (foundInList) {
    if (prev > 0) {
      qc.setQueryData<UnreadTotalResponse>(queryKeys.conversationsUnreadTotal(), (t) =>
        t ? { total: Math.max(0, t.total - prev) } : t,
      );
    }
  } else {
    // Unknown delta (list not loaded) → reconcile against the server.
    qc.invalidateQueries({ queryKey: queryKeys.conversationsUnreadTotal() });
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
