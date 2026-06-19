import { cn } from '@/lib/utils';
import Avatar from '@/components/common/Avatar';
import type { PublicUser } from '@/types/api';

interface StoryRingItemProps {
  user: PublicUser;
  hasUnseen: boolean; // coral gradient ring when unseen, muted ring when all seen
  onClick: () => void;
}

// One author's story ring in the StoryBar. Tapping opens the full-screen viewer.
export default function StoryRingItem({ user, hasUnseen, onClick }: StoryRingItemProps) {
  return (
    <button
      type="button"
      data-story-item
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-1.5"
    >
      <span
        className={cn(
          'inline-flex rounded-full p-[2px]',
          hasUnseen
            ? 'bg-gradient-to-tr from-primary to-[oklch(0.7_0.17_80)]'
            : 'bg-muted',
        )}
      >
        <span className="inline-flex rounded-full bg-background p-[2px]">
          <Avatar user={user} size="lg" className="size-16" />
        </span>
      </span>
      <span className="max-w-16 truncate text-xs">{user.username}</span>
    </button>
  );
}
