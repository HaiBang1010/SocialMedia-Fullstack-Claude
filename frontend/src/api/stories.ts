import { apiClient } from './client';
import type {
  ArchivedStoriesResponse,
  CreateStoryInput,
  Story,
  StoryFeedResponse,
  UserStoriesResponse,
  ViewersListResponse,
} from '@/types/api';

export const storiesApi = {
  // GET /stories/feed → active stories of followed users, grouped by author.
  feed: async (): Promise<StoryFeedResponse> => {
    const { data } = await apiClient.get<StoryFeedResponse>('/stories/feed');
    return data;
  },

  // GET /users/:username/stories → one user's active stories (oldest-first).
  listByUsername: async (username: string): Promise<UserStoriesResponse> => {
    const { data } = await apiClient.get<UserStoriesResponse>(
      `/users/${username}/stories`
    );
    return data;
  },

  // GET /stories/archive → the current user's own archived stories (cursor-paginated).
  listArchive: async (cursor?: string): Promise<ArchivedStoriesResponse> => {
    const { data } = await apiClient.get<ArchivedStoriesResponse>('/stories/archive', {
      params: cursor ? { cursor } : undefined,
    });
    return data;
  },

  // GET /stories/:id/views → who viewed a story (owner only, cursor-paginated).
  listViewers: async (id: string, cursor?: string): Promise<ViewersListResponse> => {
    const { data } = await apiClient.get<ViewersListResponse>(`/stories/${id}/views`, {
      params: cursor ? { cursor } : undefined,
    });
    return data;
  },

  // POST /stories → 201, bare Story.
  create: async (input: CreateStoryInput): Promise<Story> => {
    const { data } = await apiClient.post<Story>('/stories', input);
    return data;
  },

  // POST /stories/:id/view → 204 (idempotent).
  view: async (id: string): Promise<void> => {
    await apiClient.post(`/stories/${id}/view`);
  },

  // DELETE /stories/:id → 204 (owner only).
  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/stories/${id}`);
  },
};
