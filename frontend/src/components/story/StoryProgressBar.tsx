import { cn } from '@/lib/utils';

interface StoryProgressBarProps {
  durationMs: number;
  state: 'pending' | 'active' | 'complete';
  isPaused: boolean;
  onComplete: () => void;
}

// One segment of the viewer's progress row. The active segment fills 0→100% over
// the story's duration via the CSS keyframe in index.css (.animate-story-progress).
// Holding to pause only toggles animation-play-state, so the fill freezes and
// resumes in place instead of restarting — that's why the class stays mounted and
// ONLY the inline style changes. Seen/upcoming segments are static full/empty.
export default function StoryProgressBar({
  durationMs,
  state,
  isPaused,
  onComplete,
}: StoryProgressBarProps) {
  return (
    <span className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35">
      <span
        className={cn(
          'block h-full rounded-full bg-white',
          state === 'active' && 'animate-story-progress',
        )}
        style={
          state === 'active'
            ? {
                animationDuration: `${durationMs}ms`,
                animationPlayState: isPaused ? 'paused' : 'running',
              }
            : { width: state === 'complete' ? '100%' : '0%' }
        }
        onAnimationEnd={state === 'active' ? onComplete : undefined}
      />
    </span>
  );
}
