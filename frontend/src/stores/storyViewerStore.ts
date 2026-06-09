import { create } from 'zustand';

// Controls the full-screen story viewer. Three modes (Phase 4.4):
//   • 'feed'        — opened from a StoryBar ring; cross-user advance via the grouped feed.
//   • 'single-user' — opened from a profile avatar / "View story" after posting; one user,
//                     no cross-user advance.
//   • 'archive'     — opened from the Archive grid; the viewer's own archived stories,
//                     started at startStoryId. No cross-user advance, no mark-seen.
// AppLayout renders a single <StoryViewer/> bound to isOpen.
type ViewerMode = 'feed' | 'single-user' | 'archive';

interface StoryViewerState {
  isOpen: boolean;
  mode: ViewerMode;
  startUsername: string | null; // feed / single-user start point
  startStoryId: string | null; // archive deep-link start point
  open: (args: { mode: ViewerMode; startUsername?: string; startStoryId?: string }) => void;
  close: () => void;
}

export const useStoryViewerStore = create<StoryViewerState>()((set) => ({
  isOpen: false,
  mode: 'feed',
  startUsername: null,
  startStoryId: null,
  open: ({ mode, startUsername = null, startStoryId = null }) =>
    set({ isOpen: true, mode, startUsername, startStoryId }),
  close: () => set({ isOpen: false, startUsername: null, startStoryId: null }),
}));
