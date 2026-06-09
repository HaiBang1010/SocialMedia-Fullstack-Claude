import type { Story } from '@/types/api';
import StoryProgressBar from './StoryProgressBar';

// Images show for 5s; videos for their clip length (fallback 5s if duration is
// missing). The active segment's fill completion drives auto-advance (→ goNext).
const IMAGE_DURATION_MS = 5000;
const VIDEO_FALLBACK_S = 5;

interface StoryProgressBarsProps {
  stories: Story[];
  currentIndex: number;
  isPaused: boolean;
  onComplete: () => void;
}

// The row of segment bars across the top of the viewer — one per story.
export default function StoryProgressBars({
  stories,
  currentIndex,
  isPaused,
  onComplete,
}: StoryProgressBarsProps) {
  return (
    <div className="absolute inset-x-2 top-2 z-30 flex gap-1">
      {stories.map((s, i) => {
        const state =
          i < currentIndex ? 'complete' : i === currentIndex ? 'active' : 'pending';
        const durationMs =
          s.mediaType === 'VIDEO'
            ? (s.duration ?? VIDEO_FALLBACK_S) * 1000
            : IMAGE_DURATION_MS;
        return (
          <StoryProgressBar
            key={s.id}
            durationMs={durationMs}
            state={state}
            isPaused={isPaused}
            onComplete={onComplete}
          />
        );
      })}
    </div>
  );
}
