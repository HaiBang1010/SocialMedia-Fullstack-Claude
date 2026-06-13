import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import RightRail from './RightRail';
import BottomNav from './BottomNav';
import PostComposerModal from '@/components/post/PostComposerModal';
import StoryComposer from '@/components/story/StoryComposer';
import StoryViewer from '@/components/story/StoryViewer';
import { useSocketConnection } from '@/features/messaging/hooks/useSocketConnection';
import { useGlobalSocketEvents } from '@/features/messaging/hooks/useGlobalSocketEvents';

export default function AppLayout() {
  // Phase 5.2 — open the realtime socket for authenticated users + bind app-wide listeners
  // (presence, message:new). Lives here (the authed shell) so it connects on login and
  // disconnects when this layout unmounts on logout.
  useSocketConnection();
  useGlobalSocketEvents();

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      {/* pb-16 keeps content clear of the fixed BottomNav on mobile. */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <RightRail />
      <BottomNav />
      {/* Global post composer — opened from Sidebar / BottomNav / Profile. */}
      <PostComposerModal />
      {/* Global story composer + viewer — opened from the StoryBar. */}
      <StoryComposer />
      <StoryViewer />
    </div>
  );
}
