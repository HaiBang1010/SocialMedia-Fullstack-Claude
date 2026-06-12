import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  createDirectSchema,
  createGroupSchema,
  conversationResponseSchema,
  conversationListResponseSchema,
} from './conversations.schema';
import { paginationSchema } from '../posts/posts.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const validationError400 = { description: 'Validation error', ...json(validationErrorResponseSchema) };
const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const notFound404 = { description: 'Conversation not found', ...json(errorResponseSchema) };

export function registerConversationsOpenApi(registry: OpenAPIRegistry) {
  const Conversation = registry.register('Conversation', conversationResponseSchema);
  const ConversationList = registry.register('ConversationList', conversationListResponseSchema);
  const CreateDirectReq = registry.register('CreateDirectConversationRequest', createDirectSchema);
  const CreateGroupReq = registry.register('CreateGroupConversationRequest', createGroupSchema);
  const idParam = z.object({ id: z.string() });

  registry.registerPath({
    method: 'post',
    path: '/conversations/direct',
    tags: ['Conversations'],
    summary: 'Start or reuse a 1-1 conversation with a user',
    description: 'Idempotent: a second call with the same target returns the existing conversation.',
    security: [{ bearerAuth: [] }],
    request: { body: json(CreateDirectReq) },
    responses: {
      201: { description: 'The new or existing direct conversation', ...json(Conversation) },
      400: validationError400,
      401: unauthorized401,
      404: { description: 'Target user not found', ...json(errorResponseSchema) },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/conversations/group',
    tags: ['Conversations'],
    summary: 'Create a group conversation (creator becomes admin)',
    security: [{ bearerAuth: [] }],
    request: { body: json(CreateGroupReq) },
    responses: {
      201: { description: 'Created group conversation', ...json(Conversation) },
      400: validationError400,
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/conversations',
    tags: ['Conversations'],
    summary: "The current user's conversations (recent activity first)",
    description: 'Conversations the viewer participates in, ordered by latest message, cursor-paginated.',
    security: [{ bearerAuth: [] }],
    request: { query: paginationSchema },
    responses: {
      200: { description: 'Conversations', ...json(ConversationList) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/conversations/{id}',
    tags: ['Conversations'],
    summary: 'Get one conversation (participant only)',
    description: 'A non-participant receives 404 (existence hidden).',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      200: { description: 'Conversation', ...json(Conversation) },
      401: unauthorized401,
      404: notFound404,
    },
  });
}
