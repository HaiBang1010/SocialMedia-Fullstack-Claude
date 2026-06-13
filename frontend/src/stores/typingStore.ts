import { create } from 'zustand';

// Phase 5.2 — who is typing, per conversation, fed by typing:user socket events. The hook that
// receives the events (useConversationSocket) also owns a TTL timer per typist as a safety net
// for a lost typing:stop, calling clearTyping on expiry. The store just holds state.
interface TypingState {
  // conversationId -> (userId -> username)
  byConversation: Record<string, Record<string, string>>;
  setTyping: (conversationId: string, userId: string, username: string) => void;
  clearTyping: (conversationId: string, userId: string) => void;
  clearConversation: (conversationId: string) => void;
  reset: () => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  byConversation: {},

  setTyping: (conversationId, userId, username) =>
    set((s) => {
      const convo = { ...(s.byConversation[conversationId] ?? {}) };
      if (convo[userId] === username) return s; // no change
      convo[userId] = username;
      return { byConversation: { ...s.byConversation, [conversationId]: convo } };
    }),

  clearTyping: (conversationId, userId) =>
    set((s) => {
      const existing = s.byConversation[conversationId];
      if (!existing || !(userId in existing)) return s;
      const convo = { ...existing };
      delete convo[userId];
      return { byConversation: { ...s.byConversation, [conversationId]: convo } };
    }),

  clearConversation: (conversationId) =>
    set((s) => {
      if (!(conversationId in s.byConversation)) return s;
      const byConversation = { ...s.byConversation };
      delete byConversation[conversationId];
      return { byConversation };
    }),

  reset: () => set({ byConversation: {} }),
}));
