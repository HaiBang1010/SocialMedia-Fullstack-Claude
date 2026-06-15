import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { updateProfileSchema, userProfileSchema, groupableQuerySchema, groupableUserSchema } from './users.schema';
import {
  errorResponseSchema,
  validationErrorResponseSchema,
  userPublicSchema,
} from '../../lib/openapi';

// PATCH /users/me returns the self user (with email).
const userResponseSchema = z.object({ user: userPublicSchema });

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const validationError400 = {
  description: 'Validation error',
  content: { 'application/json': { schema: validationErrorResponseSchema } },
};
const unauthorized401 = {
  description: 'Unauthorized',
  content: { 'application/json': { schema: errorResponseSchema } },
};
const notFound404 = {
  description: 'User not found',
  content: { 'application/json': { schema: errorResponseSchema } },
};

export function registerUsersOpenApi(registry: OpenAPIRegistry) {
  // GET /users/:username returns the public profile DTO (counts + isFollowing).
  const UserProfile = registry.register('UserProfile', userProfileSchema);
  const profileResponseSchema = z.object({ user: UserProfile });

  registry.registerPath({
    method: 'patch',
    path: '/users/me',
    tags: ['Users'],
    summary: 'Update the current user profile',
    security: [{ bearerAuth: [] }],
    request: { body: json(updateProfileSchema) },
    responses: {
      200: { description: 'Updated user', ...json(userResponseSchema) },
      400: validationError400,
      401: unauthorized401,
    },
  });

  // GET /users/groupable — suggestion list for the group-create modal (Phase 5.5).
  const GroupableUser = registry.register('GroupableUser', groupableUserSchema);

  registry.registerPath({
    method: 'get',
    path: '/users/groupable',
    tags: ['Users'],
    summary: 'List users the viewer can add to a new group (recent partners + mutual followers)',
    security: [{ bearerAuth: [] }],
    request: { query: groupableQuerySchema },
    responses: {
      200: { description: 'Groupable users', ...json(z.array(GroupableUser)) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/users/{username}',
    tags: ['Users'],
    summary: 'Get a public user profile by username',
    description:
      'Public profile with social counts and the viewer\'s follow relationship. ' +
      'Send a bearer token to be recognized: isFollowing is null for anonymous ' +
      'viewers or self, and postsCount honors the viewer\'s post visibility.',
    // Optional auth: viewer identity gates isFollowing + postsCount visibility.
    security: [{ bearerAuth: [] }, {}],
    request: {
      params: z.object({
        username: z.string().openapi({ example: 'alice' }),
      }),
    },
    responses: {
      200: { description: 'Public user profile', ...json(profileResponseSchema) },
      404: notFound404,
    },
  });
}
