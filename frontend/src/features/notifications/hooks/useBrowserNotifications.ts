import { useCallback } from 'react';

interface BrowserNotifyOptions {
  title: string;
  body?: string;
  icon?: string | null;
  /** Where to go when the user clicks the OS notification. */
  navigateTo?: string;
}

// Phase 7 — show a native browser Notification when the tab is NOT visible (backgrounded /
// another tab), so the user notices messages + activity while away. Permission is requested
// lazily on the first opportunity (no upfront prompt). Returns a stable `notify` callback.
//
// `onNavigate` lets the caller pass the router's navigate so a click can deep-link; the OS
// notification click also focuses the tab.
export function useBrowserNotifications(onNavigate?: (to: string) => void) {
  return useCallback(
    ({ title, body, icon, navigateTo }: BrowserNotifyOptions) => {
      if (typeof Notification === 'undefined') return; // unsupported (very old / SSR)
      // Only surface an OS notification when the tab isn't being looked at.
      if (document.visibilityState === 'visible') return;

      const show = () => {
        if (Notification.permission !== 'granted') return;
        const n = new Notification(title, { body, icon: icon ?? undefined });
        n.onclick = () => {
          window.focus();
          if (navigateTo) onNavigate?.(navigateTo);
          n.close();
        };
      };

      if (Notification.permission === 'granted') {
        show();
      } else if (Notification.permission === 'default') {
        // Lazy permission request on the first background event.
        void Notification.requestPermission().then(() => show());
      }
    },
    [onNavigate],
  );
}
