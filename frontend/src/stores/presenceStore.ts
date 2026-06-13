import { create } from 'zustand';

// Phase 5.2 — who is online + their last-seen time, fed by socket presence events. Scoped to the
// current user's conversation partners (the server only emits presence for contacts, D2).
// Records (not Sets) keep updates simple with Zustand's immutable replace.
interface PresenceState {
  online: Record<string, true>; // userId -> online
  lastSeen: Record<string, string>; // userId -> ISO last-seen (set when they go offline)
  setSnapshot: (snapshot: { online: string[]; lastSeen: Record<string, string> }) => void;
  markOnline: (userId: string) => void;
  markOffline: (userId: string, lastSeenAt: string) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  online: {},
  lastSeen: {},

  // Replace the online set; merge in last-seen (keep any we already learned from live offline events).
  setSnapshot: ({ online, lastSeen }) =>
    set((s) => ({
      online: Object.fromEntries(online.map((id) => [id, true as const])),
      lastSeen: { ...s.lastSeen, ...lastSeen },
    })),

  markOnline: (userId) => set((s) => ({ online: { ...s.online, [userId]: true } })),

  markOffline: (userId, lastSeenAt) =>
    set((s) => {
      const online = { ...s.online };
      delete online[userId];
      return { online, lastSeen: { ...s.lastSeen, [userId]: lastSeenAt } };
    }),

  reset: () => set({ online: {}, lastSeen: {} }),
}));
