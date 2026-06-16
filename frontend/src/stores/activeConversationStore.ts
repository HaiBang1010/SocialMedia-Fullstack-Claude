import { create } from 'zustand';

// Phase 7 — the conversation the viewer currently has open (set by useConversationSocket on mount,
// cleared on unmount). Read by the global socket handler to NOT increment its unread badge and to
// mute the notification sound for the chat you're already looking at.
interface ActiveConversationState {
  id: string | null;
  setActive: (id: string | null) => void;
}

export const useActiveConversationStore = create<ActiveConversationState>((set) => ({
  id: null,
  setActive: (id) => set({ id }),
}));
