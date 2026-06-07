import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  createPostSchema,
  updatePostSchema,
  paginationSchema,
  postResponseSchema,
  postListResponseSchema,
  postMediaSchema,
} from './posts.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const validationError400 = { description: 'Validation error', ...json(validationErrorResponseSchema) };
const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const forbidden403 = { description: 'Forbidden — not the owner', ...json(errorResponseSchema) };
const notFound404 = { description: 'Post not found', ...json(errorResponseSchema) };

export function registerPostsOpenApi(registry: OpenAPIRegistry) {
  registry.register('PostMedia', postMediaSchema);
  const Post = registry.register('Post', postResponseSchema);
  const PostList = registry.register('PostList', postListResponseSchema);
  const CreatePostReq = registry.register('CreatePostRequest', createPostSchema);
  const UpdatePostReq = registry.register('UpdatePostRequest', updatePostSchema);

  registry.registerPath({
    method: 'post',
    path: '/posts',
    tags: ['Posts'],
    summary: 'Create a post (up to 5 images OR a single video, and/or caption)',
    description:
      'Media is either up to 5 images (carousel) or exactly one video (Phase 3.2). ' +
      'A video cannot be mixed with images.',
    security: [{ bearerAuth: [] }],
    request: { body: json(CreatePostReq) },
    responses: {
      201: { description: 'Created post', ...json(Post) },
      400: validationError400,
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/posts/{id}',
    tags: ['Posts'],
    summary: 'Get a single post by id',
    description:
      'PUBLIC posts are visible to anyone. PRIVATE/FOLLOWERS posts are visible only to the ' +
      'author; other viewers get 404 (existence is hidden, not 403).',
    // Optional auth: send a bearer token to be recognized as the owner; anonymous is also allowed.
    security: [{ bearerAuth: [] }, {}],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: { description: 'Post', ...json(Post) },
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/posts/{id}',
    tags: ['Posts'],
    summary: 'Update a post (owner only)',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }), body: json(UpdatePostReq) },
    responses: {
      200: { description: 'Updated post', ...json(Post) },
      400: validationError400,
      401: unauthorized401,
      403: forbidden403,
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/posts/{id}',
    tags: ['Posts'],
    summary: 'Delete a post and its media (owner only)',
    security: [{ bearerAuth: [] }],
    request: { params: z.object({ id: z.string() }) },
    responses: {
      204: { description: 'Deleted' },
      401: unauthorized401,
      403: forbidden403,
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/users/{username}/posts',
    tags: ['Posts'],
    summary: "List a user's posts (cursor pagination)",
    description:
      'Visibility is follow-aware: the author sees all posts; a follower sees PUBLIC + FOLLOWERS; ' +
      'others see only PUBLIC. A private account returns an empty list to non-owner non-followers.',
    // Optional auth: the author sends a bearer token to also receive their non-public posts.
    security: [{ bearerAuth: [] }, {}],
    request: {
      params: z.object({ username: z.string() }),
      query: paginationSchema,
    },
    responses: {
      200: { description: 'Paginated posts', ...json(PostList) },
      404: { description: 'User not found', ...json(errorResponseSchema) },
    },
  });
}
