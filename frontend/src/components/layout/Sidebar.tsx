import { NavLink, useNavigate } from "react-router-dom";
import {
  Compass,
  Film,
  Heart,
  Home,
  LogOut,
  Search,
  Send,
  Settings,
  SquarePlus,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import ThemeToggle from "@/components/ThemeToggle";

interface NavEntry {
  label: string;
  icon: LucideIcon;
  // `to` present → real NavLink; absent → disabled placeholder (Phase 2).
  to?: string;
}

const NAV: NavEntry[] = [
  { label: "Home", icon: Home, to: "/" },
  { label: "Search", icon: Search },
  { label: "Explore", icon: Compass },
  { label: "Reels", icon: Film },
  { label: "Messages", icon: Send },
  { label: "Notifications", icon: Heart },
  { label: "Create", icon: SquarePlus },
  { label: "Profile", icon: User, to: "/profile" },
];

const ROW = "flex items-center gap-4 rounded-lg px-3 py-2.5 text-sm transition-colors";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Sidebar() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar px-3 py-5 md:flex">
      {/* Logo */}
      <NavLink to="/" className="px-3 font-heading text-2xl font-bold tracking-tight">
        Beng<span className="text-primary">.</span>
      </NavLink>

      {/* Nav */}
      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV.map(({ label, icon: Icon, to }) =>
          to ? (
            <NavLink
              key={label}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(ROW, "hover:bg-muted", isActive && "font-bold text-primary")
              }
            >
              {({ isActive }) => (
                <>
                  <Icon strokeWidth={isActive ? 2.5 : 2} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ) : (
            <button
              key={label}
              type="button"
              disabled
              aria-disabled="true"
              className={cn(ROW, "cursor-not-allowed opacity-60")}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ),
        )}
      </nav>

      {/* Bottom section */}
      <div className="mt-4 flex flex-col gap-1 border-t pt-4">
        {user && (
          <NavLink to="/profile" className={cn(ROW, "hover:bg-muted")}>
            <span className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="size-6 object-cover"
                />
              ) : (
                initials(user.name)
              )}
            </span>
            <span className="truncate">@{user.username}</span>
          </NavLink>
        )}

        <div className="flex items-center gap-4 px-3 py-2.5">
          <ThemeToggle />
          <span className="text-sm text-muted-foreground">Theme</span>
        </div>

        <button
          type="button"
          disabled
          aria-disabled="true"
          className={cn(ROW, "cursor-not-allowed opacity-60")}
        >
          <Settings />
          <span>Settings</span>
        </button>

        <button
          type="button"
          onClick={handleLogout}
          className={cn(ROW, "hover:bg-muted")}
        >
          <LogOut />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
