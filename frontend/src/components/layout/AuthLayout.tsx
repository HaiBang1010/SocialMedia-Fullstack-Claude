import { Outlet } from "react-router-dom";
import ThemeToggle from "@/components/ThemeToggle";

export default function AuthLayout() {
  return (
    <div className="relative flex min-h-screen bg-background text-foreground">
      <ThemeToggle className="absolute right-4 top-4 z-10" />

      {/* Brand panel — desktop only */}
      <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-primary to-[oklch(0.5_0.2_25)] p-12 text-white md:flex">
        <span className="font-heading text-3xl font-bold tracking-tight">
          frame<span className="opacity-80">.</span>
        </span>
        <div>
          <p className="font-heading text-4xl font-bold leading-tight">
            Moments worth keeping.
          </p>
          <p className="mt-3 max-w-sm text-sm text-white/80">
            Share what you love with the people who matter.
          </p>
        </div>
        <span className="text-xs text-white/60">© 2026 frame</span>
      </div>

      {/* Form column */}
      <div className="flex w-full flex-col items-center justify-center p-4 md:w-1/2">
        {/* Compact brand for mobile (panel is hidden < md). */}
        <span className="mb-8 font-heading text-2xl font-bold tracking-tight md:hidden">
          Beng<span className="text-primary">.</span>
        </span>
        <Outlet />
      </div>
    </div>
  );
}
