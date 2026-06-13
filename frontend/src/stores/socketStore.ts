import { create } from 'zustand';

// Phase 5.2 — socket connection status for UI (e.g. a "reconnecting…" hint). UI state, so
// Zustand (not React Context, per frontend conventions). Not persisted.
export type SocketStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

interface SocketState {
  status: SocketStatus;
  setStatus: (status: SocketStatus) => void;
}

export const useSocketStore = create<SocketState>((set) => ({
  status: 'idle',
  setStatus: (status) => set({ status }),
}));
