import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/stores/authStore';

export default function HomePage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Smoke test: verifies Bearer header + refresh flow via infra (not real UI).
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: authApi.me,
  });

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Home — {user?.username}</h1>
      <div>{isLoading ? 'Loading...' : data?.user.name}</div>
      <button
        onClick={handleLogout}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        Logout
      </button>
    </div>
  );
}
