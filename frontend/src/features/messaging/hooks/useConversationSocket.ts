import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { useTypingStore } from '@/stores/typingStore';
import { patchReadReceipt } from '@/lib/conversationCache';
import type { MessageNewPayload, ReadReceiptPayload, TypingUserPayload } from '@/types/api';

const TYPING_TTL = 4000; // safety net: drop a typist if a typing:stop is ever lost

// Phase 5.2 — per-open-conversation socket wiring (mounted by ConversationDetail, which remounts
// per conversation via key={id}). Joins the conversation room, marks the thread read on open and
// on each incoming message, and binds typing + read-receipt events scoped to this conversation.
// The status dep re-runs this on reconnect so the room is re-joined (rooms are dropped on the
// server when the socket disconnects).
export function useConversationSocket(conversationId: string) {
  const qc = useQueryClient();
  const status = useSocketStore((s) => s.status);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('conversation:join', conversationId);
    socket.emit('message:read', { conversationId });

    const meId = useAuthStore.getState().user?.id;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const clearTimer = (userId: string) => {
      const t = timers.get(userId);
      if (t) {
        clearTimeout(t);
        timers.delete(userId);
      }
    };

    const onTyping = (p: TypingUserPayload) => {
      if (p.conversationId !== conversationId) return;
      if (p.typing) {
        useTypingStore.getState().setTyping(conversationId, p.userId, p.username);
        clearTimer(p.userId);
        timers.set(
          p.userId,
          setTimeout(() => {
            useTypingStore.getState().clearTyping(conversationId, p.userId);
            timers.delete(p.userId);
          }, TYPING_TTL),
        );
      } else {
        useTypingStore.getState().clearTyping(conversationId, p.userId);
        clearTimer(p.userId);
      }
    };

    const onReadReceipt = (p: ReadReceiptPayload) => {
      if (p.conversationId !== conversationId) return;
      patchReadReceipt(qc, conversationId, p.userId, p.lastReadMessageId);
    };

    // A message from the other person arrived while I'm viewing → mark read so they see "Seen".
    const onIncoming = (p: MessageNewPayload) => {
      if (p.conversationId !== conversationId) return;
      if (p.message.senderId === meId) return;
      socket.emit('message:read', { conversationId });
    };

    socket.on('typing:user', onTyping);
    socket.on('read-receipt:update', onReadReceipt);
    socket.on('message:new', onIncoming);

    return () => {
      socket.emit('conversation:leave', conversationId);
      socket.off('typing:user', onTyping);
      socket.off('read-receipt:update', onReadReceipt);
      socket.off('message:new', onIncoming);
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      useTypingStore.getState().clearConversation(conversationId);
    };
  }, [conversationId, qc, status]);
}
