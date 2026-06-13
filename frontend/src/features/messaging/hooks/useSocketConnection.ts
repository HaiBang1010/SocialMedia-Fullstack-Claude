import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useSocketStore } from '@/stores/socketStore';
import { usePresenceStore } from '@/stores/presenceStore';
import { useTypingStore } from '@/stores/typingStore';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { extractFailedMessages, restoreFailedMessages } from '@/lib/messageCache';
import { queryKeys } from '@/lib/queryKeys';

// Phase 5.2 — owns the socket lifecycle: connect when authenticated, disconnect on logout.
// Mounted once (AppLayout). Mirrors connection state into socketStore and, on a successful
// reconnect, refetches messaging queries — Socket.io has no missed-message replay, so this is
// the catch-up that polling used to provide. queryKeys.conversations() (['conversations']) is a
// prefix of the list, each conversation(id), and each messages(id) key, so one invalidate
// covers every mounted messaging query.
export function useSocketConnection() {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      useSocketStore.getState().setStatus('idle');
      usePresenceStore.getState().reset();
      useTypingStore.getState().reset();
      return;
    }

    const socket = connectSocket();
    const setStatus = useSocketStore.getState().setStatus;
    setStatus(socket.connected ? 'connected' : 'connecting');

    const onConnect = () => setStatus('connected');
    const onDisconnect = () => setStatus('disconnected');
    const onReconnectAttempt = () => setStatus('reconnecting');
    const onReconnect = async () => {
      setStatus('connected');
      // T7: preserve client-only failed messages across the catch-up refetch (the refetch would
      // otherwise replace the cache with server data that has no failed messages → lost retry).
      const failed = extractFailedMessages(qc);
      await qc.invalidateQueries({ queryKey: queryKeys.conversations() });
      restoreFailedMessages(qc, failed);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onReconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onReconnect);
    };
  }, [isAuthenticated, qc]);
}
