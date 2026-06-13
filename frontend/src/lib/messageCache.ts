// Cache surgery for a conversation's messages. Mirrors lib/commentCache.ts.
//
// The messages cache (queryKeys.messages(conversationId)) is InfiniteData<MessagesListResponse>
// stored NEWEST-FIRST: pages[0].messages[0] is the newest message. An optimistic message is
// prepended there (the newest position) so that, once the thread reverses for display
// (oldest top → newest bottom), it lands at the very bottom. Mappers return the SAME
// reference when nothing changes, so React Query doesn't notify observers needlessly.

import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Message, MessagesListResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

// Prepend an (optimistic) message to the FIRST page (newest position). No-op when the
// list isn't loaded yet (the user opened the thread but messages haven't arrived).
export function insertOptimisticMessage(
  qc: QueryClient,
  conversationId: string,
  message: Message,
): void {
  qc.setQueryData<InfiniteData<MessagesListResponse>>(
    queryKeys.messages(conversationId),
    (data) => {
      if (!data || data.pages.length === 0) return data;
      const pages = data.pages.map((pg, i) =>
        i === 0 ? { ...pg, messages: [message, ...pg.messages] } : pg,
      );
      return { ...data, pages };
    },
  );
}

// Replace an optimistic (temp-id) message with the server's real one, in place. Returns
// true if the temp message was found + swapped; the caller falls back to invalidate if not.
export function swapTempMessage(
  qc: QueryClient,
  conversationId: string,
  tempId: string,
  real: Message,
): boolean {
  let replaced = false;
  qc.setQueryData<InfiniteData<MessagesListResponse>>(
    queryKeys.messages(conversationId),
    (data) => {
      if (!data) return data;
      const pages = data.pages.map((page) => {
        let pageTouched = false;
        const messages = page.messages.map((m) => {
          if (m.id !== tempId) return m;
          pageTouched = true;
          replaced = true;
          return real;
        });
        return pageTouched ? { ...page, messages } : page;
      });
      return replaced ? { ...data, pages } : data;
    },
  );
  return replaced;
}

// Phase 5.2 — insert a message that arrived over the socket, at the newest position, with
// dedup. No-op if the thread isn't loaded. Three cases:
//   1. the real id is already present (our own echo after the REST swap) → no-op;
//   2. an optimistic temp from the same sender+content is still on screen (the socket echo beat
//      our REST response) → replace that temp in place, so no duplicate appears;
//   3. otherwise prepend it (a message from someone else, or our own from another tab).
export function insertIncomingMessage(
  qc: QueryClient,
  conversationId: string,
  message: Message,
): void {
  qc.setQueryData<InfiniteData<MessagesListResponse>>(
    queryKeys.messages(conversationId),
    (data) => {
      if (!data || data.pages.length === 0) return data;

      // (1) already have the real message.
      if (data.pages.some((pg) => pg.messages.some((m) => m.id === message.id))) return data;

      // (2) reconcile a still-pending optimistic temp from the same sender + content.
      let replacedTemp = false;
      const reconciled = data.pages.map((pg) => {
        if (replacedTemp) return pg;
        let touched = false;
        const messages = pg.messages.map((m) => {
          if (
            !replacedTemp &&
            m.id.startsWith('temp-') &&
            m.senderId === message.senderId &&
            m.content === message.content
          ) {
            replacedTemp = true;
            touched = true;
            return message;
          }
          return m;
        });
        return touched ? { ...pg, messages } : pg;
      });
      if (replacedTemp) return { ...data, pages: reconciled };

      // (3) prepend at the newest position (page 0).
      const pages = data.pages.map((pg, i) =>
        i === 0 ? { ...pg, messages: [message, ...pg.messages] } : pg,
      );
      return { ...data, pages };
    },
  );
}

// Whether a message id is present in the thread cache (used to decide if a send needs a
// fallback refetch when the optimistic temp was already reconciled by the socket echo).
export function messageExists(qc: QueryClient, conversationId: string, id: string): boolean {
  const data = qc.getQueryData<InfiniteData<MessagesListResponse>>(
    queryKeys.messages(conversationId),
  );
  return !!data?.pages.some((pg) => pg.messages.some((m) => m.id === id));
}

// Phase 5.2 (T7) — flip the client-only `failed` flag on an optimistic (temp-id) message.
// On send error we mark it failed (kept on screen for retry, NOT rolled back); on retry we
// clear it (back to the pending/spinner state). No-op if the message isn't in cache.
function setMessageFailed(
  qc: QueryClient,
  conversationId: string,
  tempId: string,
  failed: boolean,
): void {
  qc.setQueryData<InfiniteData<MessagesListResponse>>(
    queryKeys.messages(conversationId),
    (data) => {
      if (!data) return data;
      let touched = false;
      const pages = data.pages.map((page) => {
        let pageTouched = false;
        const messages = page.messages.map((m) => {
          if (m.id !== tempId) return m;
          pageTouched = true;
          touched = true;
          return { ...m, failed };
        });
        return pageTouched ? { ...page, messages } : page;
      });
      return touched ? { ...data, pages } : data;
    },
  );
}

export function markMessageFailed(qc: QueryClient, conversationId: string, tempId: string): void {
  setMessageFailed(qc, conversationId, tempId, true);
}

export function clearMessageFailed(qc: QueryClient, conversationId: string, tempId: string): void {
  setMessageFailed(qc, conversationId, tempId, false);
}

// Phase 5.2 (T7) — failed messages are client-only; a reconnect catch-up refetch would wipe them
// (the server has no record of a never-sent message). extractFailedMessages snapshots them from
// every messages cache BEFORE the refetch; restoreFailedMessages re-inserts them AFTER, so a
// failed bubble survives a backend restart and the user keeps the chance to retry.

const isMessagesKey = (key: unknown): key is readonly ['conversations', string, 'messages'] =>
  Array.isArray(key) && key.length === 3 && key[0] === 'conversations' && key[2] === 'messages';

export function extractFailedMessages(qc: QueryClient): Record<string, Message[]> {
  const result: Record<string, Message[]> = {};
  for (const query of qc.getQueryCache().findAll({ queryKey: ['conversations'] })) {
    if (!isMessagesKey(query.queryKey)) continue;
    const conversationId = query.queryKey[1];
    const data = query.state.data as InfiniteData<MessagesListResponse> | undefined;
    if (!data) continue;
    const failed = data.pages.flatMap((pg) => pg.messages.filter((m) => m.failed === true));
    if (failed.length) result[conversationId] = failed;
  }
  return result;
}

export function restoreFailedMessages(
  qc: QueryClient,
  snapshot: Record<string, Message[]>,
): void {
  for (const [conversationId, failedMessages] of Object.entries(snapshot)) {
    qc.setQueryData<InfiniteData<MessagesListResponse>>(
      queryKeys.messages(conversationId),
      (data) => {
        if (!data || data.pages.length === 0) return data;
        // Build guards from the refetched data: skip a failed message if its temp id is already
        // present, or if a NON-failed message with the same sender+content exists — that means a
        // retry succeeded during the refetch window, so re-inserting would duplicate it.
        const existingIds = new Set<string>();
        const reconciledKeys = new Set<string>();
        for (const pg of data.pages) {
          for (const m of pg.messages) {
            existingIds.add(m.id);
            if (m.failed !== true) reconciledKeys.add(`${m.senderId}|${m.content ?? ''}`);
          }
        }
        const toRestore = failedMessages.filter(
          (m) => !existingIds.has(m.id) && !reconciledKeys.has(`${m.senderId}|${m.content ?? ''}`),
        );
        if (toRestore.length === 0) return data;
        // Re-insert at the newest position (front of page 0), preserving their relative order.
        const pages = data.pages.map((pg, i) =>
          i === 0 ? { ...pg, messages: [...toRestore, ...pg.messages] } : pg,
        );
        return { ...data, pages };
      },
    );
  }
}
