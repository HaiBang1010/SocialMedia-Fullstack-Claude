import { useRef } from 'react';

interface LongPressOptions {
  threshold?: number; // ms held before the press fires (default 500 — mobile long-press feel)
  moveThreshold?: number; // px of movement that cancels the press (so a scroll never triggers it)
}

// Generic long-press for touch/pen: hold a target for `threshold` ms → fire callback. Movement
// past `moveThreshold` cancels it, so a scroll gesture never opens the reaction picker. NOT
// useStoryGestures (that's a viewer nav state-machine — tap-thirds/swipe-dismiss, different
// concern). Returns pointer handlers to spread on the element; harmless on desktop (mouse rarely
// holds still 500ms, and the hover button is the real desktop trigger).
export function useLongPress(callback: () => void, { threshold = 500, moveThreshold = 10 }: LongPressOptions = {}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    // Mouse long-press isn't a thing users expect; the hover button covers desktop.
    if (e.pointerType === 'mouse') return;
    clear();
    start.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      timer.current = null;
      callback();
    }, threshold);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > moveThreshold) clear();
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}
