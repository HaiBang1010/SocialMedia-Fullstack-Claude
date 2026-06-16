import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketStore } from '@/stores/socketStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useAuthStore } from '@/stores/authStore';
import { useActiveConversationStore } from '@/stores/activeConversationStore';
import { getSocket } from '@/lib/socket';
import { queryKeys } from '@/lib/queryKeys';
import { insertIncomingMessage, patchMessageReactions, patchMessageDeleted } from '@/lib/messageCache';
import { patchConversationOnNewMessage, incrementConversationUnread } from '@/lib/conversationCache';
import { prependNotification } from '@/lib/notificationCache';
import { formatMessagePreview } from '@/lib/messagePreview';
import { notificationActionText, notificationLink } from '@/lib/notificationDisplay';
import { useNotificationSound } from '@/features/notifications/hooks/useNotificationSound';
import { useBrowserNotifications } from '@/features/notifications/hooks/useBrowserNotifications';
import type {
  MessageNewPayload,
  MessageReactionPayload,
  MessageDeletedPayload,
  NotificationNewPayload,
  PresenceOfflinePayload,
  PresenceOnlinePayload,
  PresenceSnapshotPayload,
} from '@/types/api';

// Phase 5.2 — app-wide socket listeners (mounted once in AppLayout): presence + message:new.
// message:new patches the thread cache (dedup) AND the conversation list (move-to-top + preview),
// so realtime arrives whether or not the thread is open. Re-binds whenever the connection status
// changes — covering a fresh socket instance created after re-login.
//
// Phase 7 adds: unread-badge increment, a notification "ping" sound, a backgrounded-tab browser
// notification (for both incoming messages and notification:new), and the notification:new
// list/badge patch.
export function useGlobalSocketEvents() {
  const qc = useQueryClient();
  const status = useSocketStore((s) => s.status);
  const navigate = useNavigate();
  const playSound = useNotificationSound();
  const notify = useBrowserNotifications((to) => navigate(to));

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

      // Phase 7 — badge + sound + OS notification for messages from OTHERS (skip my own echo).
      const meId = useAuthStore.getState().user?.id;
      if (p.message.senderId === meId) return;
      const activeId = useActiveConversationStore.getState().id;
      if (p.conversationId !== activeId) {
        // The chat you're already looking at stays muted (UI-2) and doesn't grow its badge.
        incrementConversationUnread(qc, p.conversationId);
        playSound();
      }
      // notify() self-gates on a backgrounded tab.
      notify({
        title: p.message.sender.name,
        body: formatMessagePreview(p.message),
        icon: p.message.sender.avatarUrl,
        navigateTo: `/messages/${p.conversationId}`,
      });
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

    // Phase 7 — a new (or 1h-bumped) social notification: prepend to the list + refresh the badge
    // count (authoritative — a bump may not change it). NO sound (visual/badge only — sound is for
    // messages); a backgrounded-tab browser notification still fires, with the full action in the
    // title ("Alice liked your post").
    const onNotificationNew = (p: NotificationNewPayload) => {
      const n = p.notification;
      prependNotification(qc, n);
      qc.invalidateQueries({ queryKey: queryKeys.notificationsUnreadCount() });
      notify({
        title: `${n.actor.name} ${notificationActionText(n)}`,
        icon: n.actor.avatarUrl,
        navigateTo: notificationLink(n),
      });
    };

    socket.on('presence:snapshot', onSnapshot);
    socket.on('presence:online', onOnline);
    socket.on('presence:offline', onOffline);
    socket.on('message:new', onMessageNew);
    socket.on('message:reaction', onReaction);
    socket.on('message:deleted', onDeleted);
    socket.on('notification:new', onNotificationNew);

    return () => {
      socket.off('presence:snapshot', onSnapshot);
      socket.off('presence:online', onOnline);
      socket.off('presence:offline', onOffline);
      socket.off('message:new', onMessageNew);
      socket.off('message:reaction', onReaction);
      socket.off('message:deleted', onDeleted);
      socket.off('notification:new', onNotificationNew);
    };
  }, [qc, status, navigate, playSound, notify]);
}
