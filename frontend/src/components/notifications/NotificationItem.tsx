import { Link } from 'react-router-dom';
import Avatar from '@/components/common/Avatar';
import { formatRelativeTime } from '@/lib/format';
import { notificationActionText, notificationLink } from '@/lib/notificationDisplay';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types/api';

// One notification row: actor avatar + "username liked your post · 2m", deep-linking to the post
// (LIKE/COMMENT) or the actor's profile (FOLLOW). Unread rows get a tinted background + a dot.
export default function NotificationItem({ notification: n }: { notification: Notification }) {
  return (
    <Link
      to={notificationLink(n)}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted',
        !n.isRead && 'bg-primary/5',
      )}
    >
      <Avatar user={n.actor} size="md" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-semibold">{n.actor.username}</span>{' '}
          <span className="text-muted-foreground">{notificationActionText(n)}</span>
        </p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(n.createdAt)}</p>
      </div>
      {!n.isRead && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
    </Link>
  );
}
