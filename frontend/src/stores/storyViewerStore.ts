import { create } from 'zustand';

// Controls the full-screen story viewer. Holds the author whose ring was tapped
// (the queue's starting point); the viewer reads the grouped stories feed
// (useStoriesFeed) and advances across users from there. AppLayout renders a
// single <StoryViewer/> bound to isOpen.
interface StoryViewerState {
  isOpen: boolean;
  startUsername: string | null;
  open: (startUsername: string) => void;
  close: () => void;
}

export const useStoryViewerStore = create<StoryViewerState>()((set) => ({
  isOpen: false,
  startUsername: null,
  open: (startUsername) => set({ isOpen: true, startUsername }),
  close: () => set({ isOpen: false, startUsername: null }),
}));
