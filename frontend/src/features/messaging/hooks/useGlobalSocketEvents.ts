import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketStore } from '@/stores/socketStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { getSocket } from '@/lib/socket';
import { queryKeys } from '@/lib/queryKeys';
import { insertIncomingMessage, patchMessageReactions, patchMessageDeleted } from '@/lib/messageCache';
import { patchConversationOnNewMessage } from '@/lib/conversationCache';
import type {
  MessageNewPayload,
  MessageReactionPayload,
  MessageDeletedPayload,
  PresenceOfflinePayload,
  PresenceOnlinePayload,
  PresenceSnapshotPayload,
} from '@/types/api';

// Phase 5.2 — app-wide socket listeners (mounted once in AppLayout): presence + message:new.
// message:new patches the thread cache (dedup) AND the conversation list (move-to-top + preview),
// so realtime arrives whether or not the thread is open. Re-binds whenever the connection status
// changes — covering a fresh socket instance created after re-login.
export function useGlobalSocketEvents() {
  const qc = useQueryClient();
  const status = useSocketStore((s) => s.status);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const presence = usePresenceStore.getState();

    const onSnapshot = (p: PresenceSnapshotPayload) => presence.setSnapshot(p);
    const onOnline = (p: PresenceOnlinePayload) => presence.markOnline(p.userId);
    const onOffline = (p: PresenceOfflinePayload) => presence.markOffline(p.userId, p.lastSeenAt);
    const onMessageNew = (p: MessageNewPayload) => {
      insertIncomingMessage(qc, p.conversationId, p.message);
      patchConversationOnNewMessage(qc, p.conversationId, p.message);
    };
    // Phase 5.3a — apply a reaction delta to the thread cache (works whether or not the thread is
    // open, keeping a warm cache correct). Remove the user's prior entry, then add the new emoji.
    const onReaction = (p: MessageReactionPayload) => {
      patchMessageReactions(qc, p.conversationId, p.messageId, (cur) => {
        const filtered = cur.filter((r) => r.userId !== p.userId);
        return p.emoji === null ? filtered : [...filtered, { userId: p.userId, emoji: p.emoji }];
      });
    };
    // Phase 5.5 — recall: patch the cached message into a tombstone (works whether or not the
    // thread is open) + refetch the list so its preview skips the recalled message.
    const onDeleted = (p: MessageDeletedPayload) => {
      patchMessageDeleted(qc, p.conversationId, p.messageId, p.deletedAt);
      qc.invalidateQueries({ queryKey: queryKeys.conversations() });
    };

    socket.on('presence:snapshot', onSnapshot);
    socket.on('presence:online', onOnline);
    socket.on('presence:offline', onOffline);
    socket.on('message:new', onMessageNew);
    socket.on('message:reaction', onReaction);
    socket.on('message:deleted', onDeleted);

    return () => {
      socket.off('presence:snapshot', onSnapshot);
      socket.off('presence:online', onOnline);
      socket.off('presence:offline', onOffline);
      socket.off('message:new', onMessageNew);
      socket.off('message:reaction', onReaction);
      socket.off('message:deleted', onDeleted);
    };
  }, [qc, status]);
}
