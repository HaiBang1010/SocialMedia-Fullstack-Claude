import { useRef, useState } from 'react';

interface StoryGestureOptions {
  onPrev: () => void;
  onNext: () => void;
  onPause: () => void;
  onResume: () => void;
  onDismiss: () => void;
}

const HOLD_MS = 200; // long-press threshold → pause
const MOVE_THRESHOLD = 10; // px of movement before a press becomes a drag (not a tap)
const DISMISS_THRESHOLD = 100; // px of downward swipe before the viewer closes

// Single pointer-event state machine for the story viewer: long-press to pause,
// swipe-down to dismiss, tap left-third/right-two-thirds to navigate. One set of
// handlers on one element — two separate hooks couldn't both own onPointerDown.
// Reuses CropStage's setPointerCapture idiom so a drag keeps tracking even if the
// pointer leaves the element. Synchronous decisions in finish() read refs (not
// state) to avoid stale-closure reads of the latest drag delta.
export function useStoryGestures({
  onPrev,
  onNext,
  onPause,
  onResume,
  onDismiss,
}: StoryGestureOptions) {
  const [isPaused, setIsPaused] = useState(false);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startRef = useRef<{ x: number; y: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const movedRef = useRef(false);
  const pausedRef = useRef(false); // mirror of isPaused for synchronous reads
  const deltaYRef = useRef(0); // latest downward delta for the dismiss decision

  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const reset = () => {
    clearHold();
    startRef.current = null;
    movedRef.current = false;
    deltaYRef.current = 0;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    deltaYRef.current = 0;
    clearHold();
    holdTimerRef.current = setTimeout(() => {
      pausedRef.current = true;
      setIsPaused(true);
      onPause();
    }, HOLD_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;
    if (!movedRef.current && Math.hypot(dx, dy) > MOVE_THRESHOLD) {
      movedRef.current = true;
      clearHold(); // a drag cancels the pending hold-pause
      setIsDragging(true);
    }
    if (movedRef.current && dy > 0) {
      deltaYRef.current = dy;
      setTranslateY(dy);
    }
  };

  const releasePause = () => {
    pausedRef.current = false;
    setIsPaused(false);
    onResume();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    const wasPaused = pausedRef.current;
    const wasDrag = movedRef.current;
    const dy = deltaYRef.current;
    reset();

    // Priority: hold > swipe > tap.
    if (wasPaused) {
      releasePause();
      return;
    }
    if (wasDrag) {
      setIsDragging(false);
      setTranslateY(0);
      if (dy > DISMISS_THRESHOLD) onDismiss();
      return;
    }
    // Clean tap → left third = previous, right two-thirds = next.
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (ratio < 1 / 3) onPrev();
    else onNext();
  };

  // Browser took over the gesture: clean up + snap back, never navigate/dismiss.
  const onPointerCancel = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    const wasPaused = pausedRef.current;
    reset();
    setIsDragging(false);
    setTranslateY(0);
    if (wasPaused) releasePause();
  };

  return {
    isPaused,
    translateY,
    isDragging,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
  };
}
