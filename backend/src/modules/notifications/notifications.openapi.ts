import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  notificationResponseSchema,
  notificationListResponseSchema,
  unreadCountResponseSchema,
} from './notifications.schema';
import { paginationSchema } from '../posts/posts.schema';
import { errorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };

export function registerNotificationsOpenApi(registry: OpenAPIRegistry) {
  registry.register('Notification', notificationResponseSchema);
  const NotificationList = registry.register('NotificationList', notificationListResponseSchema);
  const UnreadCount = registry.register('UnreadCount', unreadCountResponseSchema);
  const idParam = z.object({ id: z.string() });
  const okSchema = z.object({ ok: z.boolean() });
  const countSchema = z.object({ count: z.number().int() });

  registry.registerPath({
    method: 'get',
    path: '/notifications',
    tags: ['Notifications'],
    summary: "The viewer's notifications (newest-first, cursor)",
    security: [{ bearerAuth: [] }],
    request: { query: paginationSchema },
    responses: {
      200: { description: 'Notifications', ...json(NotificationList) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/notifications/unread-count',
    tags: ['Notifications'],
    summary: 'Count of unread notifications (nav badge)',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Unread count', ...json(UnreadCount) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/notifications/read-all',
    tags: ['Notifications'],
    summary: 'Mark all notifications read',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Number marked read', ...json(countSchema) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/notifications/{id}/read',
    tags: ['Notifications'],
    summary: 'Mark one notification read (idempotent)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: { description: 'OK', ...json(okSchema) },
      401: unauthorized401,
    },
  });
}
