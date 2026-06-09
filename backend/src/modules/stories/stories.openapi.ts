import { z } from 'zod';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import {
  createStorySchema,
  storyResponseSchema,
  storyItemResponseSchema,
  storyFeedResponseSchema,
  userStoriesResponseSchema,
  archivedStoriesResponseSchema,
  viewersListResponseSchema,
} from './stories.schema';
import { paginationSchema } from '../posts/posts.schema';
import { errorResponseSchema, validationErrorResponseSchema } from '../../lib/openapi';

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

const validationError400 = { description: 'Validation error', ...json(validationErrorResponseSchema) };
const unauthorized401 = { description: 'Unauthorized', ...json(errorResponseSchema) };
const forbidden403 = { description: 'Forbidden — not the owner', ...json(errorResponseSchema) };
const notFound404 = { description: 'Story not found', ...json(errorResponseSchema) };

export function registerStoriesOpenApi(registry: OpenAPIRegistry) {
  // Register StoryItem first so the Story schema $refs it (same schema object reference).
  registry.register('StoryItem', storyItemResponseSchema);
  const Story = registry.register('Story', storyResponseSchema);
  const StoryFeed = registry.register('StoryFeed', storyFeedResponseSchema);
  const UserStories = registry.register('UserStories', userStoriesResponseSchema);
  const ArchivedStories = registry.register('ArchivedStories', archivedStoriesResponseSchema);
  const ViewersList = registry.register('StoryViewers', viewersListResponseSchema);
  const CreateStoryReq = registry.register('CreateStoryRequest', createStorySchema);
  const idParam = z.object({ id: z.string() });
  const paginationQuery = paginationSchema;

  registry.registerPath({
    method: 'post',
    path: '/stories',
    tags: ['Stories'],
    summary: 'Create a story (a single image or video, 24h visibility)',
    security: [{ bearerAuth: [] }],
    request: { body: json(CreateStoryReq) },
    responses: {
      201: { description: 'Created story', ...json(Story) },
      400: validationError400,
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/stories/feed',
    tags: ['Stories'],
    summary: 'Active stories of followed users, grouped by author',
    description:
      'Returns active (not expired, not archived) stories from users the viewer follows, ' +
      'grouped by author. Groups with unseen stories come first, then by latest activity.',
    security: [{ bearerAuth: [] }],
    responses: {
      200: { description: 'Grouped story feed', ...json(StoryFeed) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/stories/archive',
    tags: ['Stories'],
    summary: "The current user's own archived (expired) stories",
    description: 'Archived stories of the authenticated user, newest-first, cursor-paginated.',
    security: [{ bearerAuth: [] }],
    request: { query: paginationQuery },
    responses: {
      200: { description: 'Archived stories', ...json(ArchivedStories) },
      401: unauthorized401,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/stories/{id}/views',
    tags: ['Stories'],
    summary: 'List who viewed a story (owner only)',
    description: 'Viewers of a story, most-recent first, cursor-paginated. Owner only (403 otherwise).',
    security: [{ bearerAuth: [] }],
    request: { params: idParam, query: paginationQuery },
    responses: {
      200: { description: 'Story viewers', ...json(ViewersList) },
      401: unauthorized401,
      403: forbidden403,
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/stories/{id}/view',
    tags: ['Stories'],
    summary: 'Mark a story as viewed (idempotent)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      204: { description: 'Marked viewed' },
      401: unauthorized401,
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/stories/{id}',
    tags: ['Stories'],
    summary: 'Delete a story and its media (owner only)',
    security: [{ bearerAuth: [] }],
    request: { params: idParam },
    responses: {
      204: { description: 'Deleted' },
      401: unauthorized401,
      403: forbidden403,
      404: notFound404,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/users/{username}/stories',
    tags: ['Stories'],
    summary: "List a user's active stories",
    description:
      'Active stories of a user (oldest-first). A private account returns an empty list to ' +
      'non-owner non-followers.',
    // Optional auth: a follower/owner sends a bearer token to see FOLLOWERS-level visibility
    // and per-story isViewedByMe.
    security: [{ bearerAuth: [] }, {}],
    request: { params: z.object({ username: z.string() }) },
    responses: {
      200: { description: 'Active stories', ...json(UserStories) },
      404: { description: 'User not found', ...json(errorResponseSchema) },
    },
  });
}
