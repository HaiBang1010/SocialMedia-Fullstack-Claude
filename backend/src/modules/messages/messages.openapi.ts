import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  sendMessageSchema,
  messageResponseSchema,
  messagesListResponseSchema,
} from './messages.schema';
import { paginationSchema } from '../posts/posts.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const validationError400 = { description: 'Validation error', ...json(validationErrorResponseSchema) };
const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const forbidden403 = { description: 'Forbidden — not a participant', ...json(errorResponseSchema) };
const notFound404 = { description: 'Conversation not found', ...json(errorResponseSchema) };

// Registered before the conversations module so the Conversation schema $refs Message
// (same schema object reference) instead of inlining it.
export function registerMessagesOpenApi(registry: OpenAPIRegistry) {
  const Message = registry.register('Message', messageResponseSchema);
  const MessageList = registry.register('MessageList', messagesListResponseSchema);
  const SendMessageReq = registry.register('SendMessageRequest', sendMessageSchema);
  const idParam = z.object({ id: z.string() });

  registry.registerPath({
    method: 'get',
    path: '/conversations/{id}/messages',
    tags: ['Messages'],
    summary: "List a conversation's messages (newest-first, participant only)",
    security: [{ bearerAuth: [] }],
    request: { params: idParam, query: paginationSchema },
    responses: {
      200: { description: 'Messages', ...json(MessageList) },
      401: unauthorized401,
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/conversations/{id}/messages',
    tags: ['Messages'],
    summary: 'Send a text message (participant only)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam, body: json(SendMessageReq) },
    responses: {
      201: { description: 'Created message', ...json(Message) },
      400: validationError400,
      401: unauthorized401,
      403: forbidden403,
    },
  });
}
