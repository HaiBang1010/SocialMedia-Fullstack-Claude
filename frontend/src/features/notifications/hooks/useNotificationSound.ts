import { useCallback, useRef } from 'react';

// Phase 7 — a one-shot notification "ping" (mirrors Phase 6 useRingtone, but no loop). Preloads
// the asset once and returns a stable play() callback. Chrome's autoplay policy may block playback
// without a prior user gesture; we swallow that rejection (the browser Notification + badge still
// fire). The asset at public/sounds/notification.mp3 is OPTIONAL — if it 404s, play() just rejects
// and is silently caught (visual-only), exactly like the optional ringtone.
export function useNotificationSound() {
  const ref = useRef<HTMLAudioElement | null>(null);
  if (ref.current === null) {
    const audio = new Audio('/sounds/notification.mp3');
    audio.preload = 'auto';
    ref.current = audio;
  }

  return useCallback(() => {
    const audio = ref.current!;
    audio.currentTime = 0;
    void audio.play().catch(() => {
      /* autoplay blocked or asset missing → visual-only */
    });
  }, []);
}
