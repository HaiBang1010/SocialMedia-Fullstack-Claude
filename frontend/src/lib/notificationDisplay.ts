import type { Notification } from '@/types/api';

// Phase 7 — shared rendering of a notification's action text + deep-link, reused by the
// NotificationItem row and the realtime sound/browser-notification handler.

export function notificationActionText(n: Notification): string {
  switch (n.type) {
    case 'LIKE':
      return 'liked your post';
    case 'COMMENT':
      return 'commented on your post';
    case 'FOLLOW':
      return 'started following you';
  }
}

/** Where a notification navigates on click: the post for LIKE/COMMENT, the actor's profile for FOLLOW. */
export function notificationLink(n: Notification): string {
  if (n.type === 'FOLLOW') return `/users/${n.actor.username}`;
  return n.postId ? `/posts/${n.postId}` : `/users/${n.actor.username}`;
}
