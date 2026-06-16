import { Prisma, NotificationType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { publicUserSelect } from '../users/users.service';
import { emitNotification } from '../../socket/io';
import type { PaginationInput } from '../posts/posts.schema';

// Phase 7 — collapse repeat events (same actor liking the same post, etc.) within this window
// into ONE row instead of spamming the recipient. The dedupe key is recipient+actor+type+ref;
// because it includes a time window it can't be a DB unique constraint — it's enforced here.
const DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1h

// Lazy (a function, like postInclude) — reading publicUserSelect at module-eval time would hit a
// circular-init TDZ via follows.service → notifications.service → users.service. Calling it at
// query-time is past that cycle, so publicUserSelect is fully initialised.
const notificationInclude = () =>
  ({ actor: { select: publicUserSelect } }) satisfies Prisma.NotificationInclude;

type NotificationRow = Prisma.NotificationGetPayload<{
  include: ReturnType<typeof notificationInclude>;
}>;

/** Whitelist DTO — readAt collapses to a boolean `isRead`; postId/commentId are deep-link targets. */
function serializeNotification(n: NotificationRow) {
  return {
    id: n.id,
    type: n.type,
    actor: n.actor,
    postId: n.postId,
    commentId: n.commentId,
    isRead: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  };
}

export interface CreateNotificationInput {
  type: NotificationType;
  actorId: string;
  postId?: string | null;
  commentId?: string | null;
}

/**
 * Create (or 1h-dedupe-bump) a notification, then push it over the socket. Returns the DTO, or
 * null when skipped (self-action). Dedupe: `updateMany` is a single atomic statement, so the
 * "bump existing row" path has no read-modify-write race; the residual first-insert race (two
 * simultaneous first-likes) is benign — the next bump within the hour collapses the duplicate
 * (see plan Risk #2). Do NOT add a unique constraint to "fix" it — a time-windowed key can't be one.
 */
export async function createNotification(recipientId: string, input: CreateNotificationInput) {
  // Never notify yourself about your own action.
  if (recipientId === input.actorId) return null;

  const postId = input.postId ?? null;
  const commentId = input.commentId ?? null;
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);

  const dedupeWhere = {
    recipientId,
    actorId: input.actorId,
    type: input.type,
    postId,
    commentId,
  };

  // Bump any matching recent row: refresh createdAt (re-sorts to top) + mark unread again.
  const bumped = await prisma.notification.updateMany({
    where: { ...dedupeWhere, createdAt: { gte: since } },
    data: { createdAt: new Date(), readAt: null },
  });

  let notification: NotificationRow | null;
  if (bumped.count > 0) {
    // updateMany returns no rows — re-fetch the freshest matching one to serialize + emit.
    notification = await prisma.notification.findFirst({
      where: dedupeWhere,
      orderBy: { createdAt: 'desc' },
      include: notificationInclude(),
    });
  } else {
    notification = await prisma.notification.create({
      data: { recipientId, actorId: input.actorId, type: input.type, postId, commentId },
      include: notificationInclude(),
    });
  }

  if (!notification) return null;
  const dto = serializeNotification(notification);
  emitNotification(recipientId, dto);
  return dto;
}

/**
 * Best-effort wrapper — a notification failure must NEVER turn a successful like/comment/follow
 * into a 500. Mirrors the soft-fail S3 cleanup in posts/messages services (log + swallow).
 */
export async function safeNotify(recipientId: string, input: CreateNotificationInput) {
  try {
    return await createNotification(recipientId, input);
  } catch (err) {
    console.error('[notify] failed (non-fatal):', err);
    return null;
  }
}

/** The viewer's notifications, newest-first (createdAt desc, id desc). Cursor on id. */
export async function listNotifications(userId: string, pagination: PaginationInput) {
  const { cursor, limit } = pagination;

  const rows = await prisma.notification.findMany({
    where: { recipientId: userId },
    include: notificationInclude(),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  return { notifications: slice.map(serializeNotification), nextCursor };
}

/**
 * Mark one notification read. Scoped by recipientId via updateMany so a non-owner / missing id is
 * a silent no-op (no existence leak), mirroring the idempotent unlike/remove-reaction posture.
 */
export async function markRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { ok: true };
}

/** Mark every unread notification of the viewer as read. */
export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { count: result.count };
}

/** Count the viewer's unread notifications (powers the nav badge). */
export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { recipientId: userId, readAt: null },
  });
  return { count };
}
