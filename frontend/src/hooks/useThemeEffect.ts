import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

/**
 * Sync the themeStore value to the `.dark` class on <html>.
 * Call once at the app root (App.tsx). The FOUC script in index.html
 * sets the initial class before React mounts; this keeps it in sync afterwards.
 */
export function useThemeEffect(): void {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
}
