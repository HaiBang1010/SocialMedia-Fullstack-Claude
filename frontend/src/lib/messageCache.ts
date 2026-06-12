// Cache surgery for a conversation's messages. Mirrors lib/commentCache.ts.
//
// The messages cache (queryKeys.messages(conversationId)) is InfiniteData<MessagesListResponse>
// stored NEWEST-FIRST: pages[0].messages[0] is the newest message. An optimistic message is
// prepended there (the newest position) so that, once the thread reverses for display
// (oldest top → newest bottom), it lands at the very bottom. Mappers return the SAME
// reference when nothing changes, so React Query doesn't notify observers needlessly.

import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
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

// Snapshot the messages cache for rollback in onError.
export interface MessageCacheSnapshot {
  key: QueryKey;
  data: InfiniteData<MessagesListResponse> | undefined;
}

export function snapshotMessages(qc: QueryClient, conversationId: string): MessageCacheSnapshot {
  const key = queryKeys.messages(conversationId);
  return { key, data: qc.getQueryData<InfiniteData<MessagesListResponse>>(key) };
}

export function restoreMessages(qc: QueryClient, snap: MessageCacheSnapshot): void {
  qc.setQueryData(snap.key, snap.data);
}
