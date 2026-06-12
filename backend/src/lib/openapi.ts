import { z } from 'zod';
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi';
import { env } from '../config/env';

// Must run before any *.openapi.ts file calls .openapi() on a Zod schema.
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

export const errorResponseSchema = registry.register(
  'Error',
  z
    .object({
      error: z.string(),
      message: z.string(),
    })
    .openapi({ example: { error: 'Unauthorized', message: 'Token không hợp lệ' } }),
);

export const userPublicSchema = registry.register(
  'User',
  z.object({
    id: z.string(),
    username: z.string(),
    email: z.string().email(),
    name: z.string(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    isPrivate: z.boolean(),
    createdAt: z.string().datetime(),
  }),
);

export const validationErrorResponseSchema = registry.register(
  'ValidationError',
  z
    .object({
      error: z.literal('ValidationError'),
      message: z.string(),
      details: z.record(z.array(z.string())),
    })
    .openapi({
      example: {
        error: 'ValidationError',
        message: 'Dữ liệu không hợp lệ',
        details: { email: ['Email không hợp lệ'] },
      },
    }),
);

let registered = false;
function registerAll() {
  if (registered) return;
  // Lazy require to break circular import — these modules import schemas from this file.
  const { registerAuthOpenApi } = require('../modules/auth/auth.openapi');
  const { registerUsersOpenApi } = require('../modules/users/users.openapi');
  const { registerMediaOpenApi } = require('../modules/media/media.openapi');
  const { registerPostsOpenApi } = require('../modules/posts/posts.openapi');
  const { registerFollowsOpenApi } = require('../modules/follows/follows.openapi');
  const { registerLikesOpenApi } = require('../modules/likes/likes.openapi');
  const { registerCommentsOpenApi } = require('../modules/comments/comments.openapi');
  const { registerFeedOpenApi } = require('../modules/feed/feed.openapi');
  const { registerStoriesOpenApi } = require('../modules/stories/stories.openapi');
  // Messages registered before Conversations so the Conversation schema $refs Message.
  const { registerMessagesOpenApi } = require('../modules/messages/messages.openapi');
  const { registerConversationsOpenApi } = require('../modules/conversations/conversations.openapi');
  const { registerHealthOpenApi } = require('./health.openapi');
  registerAuthOpenApi(registry);
  registerUsersOpenApi(registry);
  registerMediaOpenApi(registry);
  registerPostsOpenApi(registry);
  registerFollowsOpenApi(registry);
  registerLikesOpenApi(registry);
  registerCommentsOpenApi(registry);
  registerFeedOpenApi(registry);
  registerStoriesOpenApi(registry);
  registerMessagesOpenApi(registry);
  registerConversationsOpenApi(registry);
  registerHealthOpenApi(registry);
  registered = true;
}

export function buildOpenApiDocument() {
  registerAll();
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Social Media API',
      version: '0.1.0',
      description: 'Instagram-like social media backend — auto-generated from Zod schemas.',
    },
    servers: [{ url: `http://localhost:${env.PORT}` }],
    tags: [
      { name: 'Auth' },
      { name: 'Users' },
      { name: 'Media' },
      { name: 'Posts' },
      { name: 'Follows' },
      { name: 'Likes' },
      { name: 'Comments' },
      { name: 'Feed', description: 'Personalized feed from following users' },
      { name: 'Stories', description: 'Ephemeral 24-hour stories' },
      { name: 'Conversations', description: 'Direct + group conversations' },
      { name: 'Messages', description: 'Messages within a conversation' },
      { name: 'Meta' },
    ],
  });
}
