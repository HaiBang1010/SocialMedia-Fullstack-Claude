import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);

  return (
    <div onClick={toggle} aria-label="Toggle theme" className={className}>
      {theme === "dark" ? <Sun /> : <Moon />}
    </div>
  );
}
