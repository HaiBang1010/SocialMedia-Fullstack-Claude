import { useCallback, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';

const HEARTBEAT = 2500; // re-emit typing:start at most every 2.5s while actively typing
const STOP_DEBOUNCE = 3000; // emit typing:stop after 3s of no keystrokes

// Phase 5.2 — typing emit helpers for the message input. start() emits typing:start on the first
// keystroke and then as a HEARTBEAT (every 2.5s) while typing, so the receiver's typing TTL (4s)
// keeps refreshing during continuous typing (otherwise the indicator would expire mid-typing and
// never reappear, since the sender used to emit only once). A trailing timer emits typing:stop
// after 3s idle; stop() emits it immediately (on send / blur / unmount).
export function useTypingEmit(conversationId: string) {
  const activeRef = useRef(false);
  const lastEmitRef = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStopTimer = () => {
    if (stopTimer.current) {
      clearTimeout(stopTimer.current);
      stopTimer.current = null;
    }
  };

  const stop = useCallback(() => {
    clearStopTimer();
    if (!activeRef.current) return;
    activeRef.current = false;
    lastEmitRef.current = 0;
    getSocket()?.emit('typing:stop', conversationId);
  }, [conversationId]);

  const start = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    const now = Date.now();
    // First keystroke, or the heartbeat interval has elapsed → (re)emit typing:start.
    if (!activeRef.current || now - lastEmitRef.current >= HEARTBEAT) {
      activeRef.current = true;
      lastEmitRef.current = now;
      socket.emit('typing:start', conversationId);
    }
    // Always re-arm the stop debounce so typing:stop fires 3s after the last keystroke.
    clearStopTimer();
    stopTimer.current = setTimeout(stop, STOP_DEBOUNCE);
  }, [conversationId, stop]);

  // Stop typing when the input unmounts or the conversation changes.
  useEffect(() => stop, [stop]);

  return { start, stop };
}
