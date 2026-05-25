import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { updateProfileSchema } from './users.schema';
import {
  errorResponseSchema,
  validationErrorResponseSchema,
  userPublicSchema,
} from '../../lib/openapi';

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

  registry.registerPath({
    method: 'get',
    path: '/users/{username}',
    tags: ['Users'],
    summary: 'Get a public user profile by username',
    request: {
      params: z.object({
        username: z.string().openapi({ example: 'alice' }),
      }),
    },
    responses: {
      200: { description: 'Public user profile', ...json(userResponseSchema) },
      404: notFound404,
    },
  });
}
