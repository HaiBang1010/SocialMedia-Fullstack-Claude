import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import RightRail from './RightRail';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      {/* pb-16 keeps content clear of the fixed BottomNav on mobile. */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <RightRail />
      <BottomNav />
    </div>
  );
}
