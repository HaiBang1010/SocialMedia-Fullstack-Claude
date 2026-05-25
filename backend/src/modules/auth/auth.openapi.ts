import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { registerSchema, loginSchema, refreshSchema } from './auth.schema';
import {
  errorResponseSchema,
  validationErrorResponseSchema,
  userPublicSchema,
} from '../../lib/openapi';

const authTokensSchema = z.object({
  user: userPublicSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});

const refreshResponseSchema = z.object({ accessToken: z.string() });
const meResponseSchema = z.object({ user: userPublicSchema });
const logoutResponseSchema = z.object({ message: z.string() });

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

// Schemas were registered via registry.register() in lib/openapi.ts,
// so referencing them here auto-emits $ref instead of inlining.
const validationError400 = {
  description: 'Validation error',
  content: { 'application/json': { schema: validationErrorResponseSchema } },
};
const unauthorized401 = {
  description: 'Unauthorized',
  content: { 'application/json': { schema: errorResponseSchema } },
};
const conflict409 = {
  description: 'Conflict — username/email already exists',
  content: { 'application/json': { schema: errorResponseSchema } },
};
export function registerAuthOpenApi(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/auth/register',
    tags: ['Auth'],
    summary: 'Create a new user account',
    request: { body: json(registerSchema) },
    responses: {
      201: { description: 'Created', ...json(authTokensSchema) },
      400: validationError400,
      409: conflict409,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/login',
    tags: ['Auth'],
    summary: 'Login with email or username',
    request: { body: json(loginSchema) },
    responses: {
      200: { description: 'Login successful', ...json(authTokensSchema) },
      400: validationError400,
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/refresh',
    tags: ['Auth'],
    summary: 'Exchange refresh token for a new access token',
    request: { body: json(refreshSchema) },
    responses: {
      200: { description: 'New access token issued', ...json(refreshResponseSchema) },
      400: validationError400,
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/auth/me',
    tags: ['Auth'],
    summary: 'Get the currently authenticated user',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Current user', ...json(meResponseSchema) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/auth/logout',
    tags: ['Auth'],
    summary: 'Logout placeholder (stateless JWT)',
    responses: {
      200: { description: 'Logged out', ...json(logoutResponseSchema) },
    },
  });
}
