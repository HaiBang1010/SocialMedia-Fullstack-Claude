import { initials } from '@/components/common/Avatar';
import { cn } from '@/lib/utils';
import type { PublicUser } from '@/types/api';

interface GroupAvatarProps {
  users: PublicUser[]; // all members, insert order; sliced internally
  size?: 'sm' | 'md' | 'lg';
}

// Container matches the single-Avatar footprint at each size (no layout shift vs DIRECT). Each
// circle is half the container so the three tile into a triangle.
const TUNING = {
  sm: { container: 'size-8', circle: 'size-4', text: 'text-[7px]' },
  md: { container: 'size-10', circle: 'size-5', text: 'text-[9px]' },
  lg: { container: 'size-14', circle: 'size-7', text: 'text-[11px]' },
} as const;

// Phase 5.3c — composite avatar for GROUP conversations, laid out as a triangle (two on top, one
// centered below). ≥3 members → 3 circles; >3 → two avatars + a "+N" badge in the bottom slot
// (N = total − 2); a legacy 2-member group → the two top circles only. Renders image/initials
// directly (not <Avatar>) so the small circles size exactly, with no double rounded/ring layers.
// No presence dot (per-participant presence is out of scope for the composite).
export default function GroupAvatar({ users, size = 'md' }: GroupAvatarProps) {
  const { container, circle, text } = TUNING[size];
  const total = users.length;
  const showBadge = total > 3;
  const visible = showBadge ? users.slice(0, 2) : users.slice(0, 3);
  const badgeCount = total - 2;

  const slot = (pos: string) =>
    cn(
      'absolute flex items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground ring-2 ring-background',
      circle,
      text,
      pos,
    );

  const content = (user: PublicUser) =>
    user.avatarUrl ? (
      <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
    ) : (
      <span>{initials(user.name)}</span>
    );

  return (
    <span className={cn('relative inline-block shrink-0', container)}>
      {visible[0] && <span className={slot('left-0 top-0')}>{content(visible[0])}</span>}
      {visible[1] && <span className={slot('right-0 top-0')}>{content(visible[1])}</span>}
      {showBadge ? (
        <span className={slot('bottom-0 left-1/2 -translate-x-1/2')}>+{badgeCount}</span>
      ) : (
        visible[2] && (
          <span className={slot('bottom-0 left-1/2 -translate-x-1/2')}>{content(visible[2])}</span>
        )
      )}
    </span>
  );
}
