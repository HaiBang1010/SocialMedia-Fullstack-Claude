import {
  Routes,
  Route,
  Navigate,
  useLocation,
  type Location,
} from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import PublicOnlyRoute from '@/components/PublicOnlyRoute';
import AppLayout from '@/components/layout/AppLayout';
import AuthLayout from '@/components/layout/AuthLayout';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { useAuthStore } from '@/stores/authStore';
import FeedPage from '@/pages/FeedPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import UserProfilePage from '@/pages/UserProfilePage';
import PostDetailPage from '@/pages/PostDetailPage';
import ArchivePage from '@/pages/ArchivePage';
import PostDetailModal from '@/components/post/PostDetailModal';

// `/profile` is a stable alias for the current user's own profile URL. It lives
// under ProtectedRoute, so a user always exists here.
function ProfileRedirect() {
  const username = useAuthStore((s) => s.user?.username);
  return <Navigate to={username ? `/users/${username}` : '/login'} replace />;
}

export default function App() {
  // Keep <html> `.dark` class in sync with the theme store.
  useThemeEffect();

  // When a post is opened from the feed on desktop, we stash the feed location
  // in `state.background` so the main <Routes> keeps rendering the feed while
  // the post shows as an overlay. Mobile/direct loads have no background, so
  // `/posts/:id` resolves to the full PostDetailPage instead.
  const location = useLocation();
  const background = (location.state as { background?: Location } | null)?.background;

  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<PublicOnlyRoute />}>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<FeedPage />} />
            <Route path="/profile" element={<ProfileRedirect />} />
            <Route path="/me/stories/archive" element={<ArchivePage />} />
            <Route path="/users/:username" element={<UserProfilePage />} />
            <Route path="/posts/:id" element={<PostDetailPage />} />
          </Route>
        </Route>
      </Routes>

      {/* Overlay modal — only mounts when navigated with a background location. */}
      {background && (
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/posts/:id" element={<PostDetailModal />} />
          </Route>
        </Routes>
      )}
    </>
  );
}
