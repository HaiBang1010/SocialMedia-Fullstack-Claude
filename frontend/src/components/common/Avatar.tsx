import { cn } from '@/lib/utils';

// Up-to-two-letter fallback when a user has no avatar image.
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const SIZES = {
  xs: 'size-6 text-[0.6rem]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
} as const;

// Presence dot sizes, paired to each avatar size (Phase 5.2).
const DOT_SIZES = {
  xs: 'size-1.5',
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3.5',
} as const;

interface AvatarUser {
  name: string;
  avatarUrl?: string | null;
}

interface AvatarProps {
  user: AvatarUser;
  size?: keyof typeof SIZES;
  className?: string;
  // Phase 5.2 — when true, show a green presence dot at the bottom-right. The dot sits OUTSIDE
  // the clipped circle (it's a sibling of the overflow-hidden image) so it isn't cut off.
  online?: boolean;
}

// Round avatar: shows the image when present, initials otherwise. Optional online dot overlay.
// The OUTER wrapper carries the size + rounded shape (so caller `className` size/ring overrides
// land on a round, correctly-sized element — matching pre-5.2 behaviour); the inner circle fills
// it via size-full and clips the image. The online dot is a sibling outside the clipped circle.
export default function Avatar({ user, size = 'md', className, online }: AvatarProps) {
  return (
    <span className={cn('relative inline-flex shrink-0 rounded-full', SIZES[size], className)}>
      <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
        ) : (
          initials(user.name)
        )}
      </span>
      {online && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full bg-green-500 ring-2 ring-background',
            DOT_SIZES[size],
          )}
          aria-label="Online"
        />
      )}
    </span>
  );
}
