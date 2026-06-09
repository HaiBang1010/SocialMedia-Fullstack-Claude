// Cache surgery for stories. A story lives in up to two caches at once:
//   - queryKeys.storiesFeed()         → StoryFeedResponse (grouped by author)
//   - queryKeys.userStories(username) → UserStoriesResponse (one author)
//
// Both are plain useQuery caches (NOT infinite). Mutations (mark viewed / delete)
// keep them in sync here so the patch logic lives once instead of per hook.
// Mirrors lib/postCache.ts.

import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type {
  ArchivedStoriesResponse,
  StoryFeedResponse,
  UserStoriesResponse,
} from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

// Mark one story viewed in the feed group + the user's stories list, recomputing
// the group's hasUnseenStory ring flag. Returns the SAME reference for a cache
// that doesn't hold the story so React Query doesn't notify spurious observers.
export function markStoryViewedInCaches(
  qc: QueryClient,
  username: string,
  storyId: string,
): void {
  qc.setQueryData<StoryFeedResponse>(queryKeys.storiesFeed(), (data) => {
    if (!data) return data;
    let touched = false;
    const items = data.items.map((group) => {
      if (!group.stories.some((s) => s.id === storyId)) return group;
      touched = true;
      const stories = group.stories.map((s) =>
        s.id === storyId ? { ...s, isViewedByMe: true } : s,
      );
      return { ...group, stories, hasUnseenStory: stories.some((s) => !s.isViewedByMe) };
    });
    return touched ? { ...data, items } : data;
  });

  qc.setQueryData<UserStoriesResponse>(queryKeys.userStories(username), (data) => {
    if (!data) return data;
    let touched = false;
    const stories = data.stories.map((s) => {
      if (s.id !== storyId) return s;
      touched = true;
      return { ...s, isViewedByMe: true };
    });
    return touched ? { ...data, stories } : data;
  });
}

// Remove a story from both caches (delete). A feed group that becomes empty is
// dropped so its ring disappears from the StoryBar.
export function removeStoryFromCaches(
  qc: QueryClient,
  username: string,
  storyId: string,
): void {
  qc.setQueryData<StoryFeedResponse>(queryKeys.storiesFeed(), (data) => {
    if (!data) return data;
    let touched = false;
    const items = data.items
      .map((group) => {
        if (!group.stories.some((s) => s.id === storyId)) return group;
        touched = true;
        const stories = group.stories.filter((s) => s.id !== storyId);
        return { ...group, stories, hasUnseenStory: stories.some((s) => !s.isViewedByMe) };
      })
      .filter((group) => group.stories.length > 0);
    return touched ? { ...data, items } : data;
  });

  qc.setQueryData<UserStoriesResponse>(queryKeys.userStories(username), (data) => {
    if (!data) return data;
    const stories = data.stories.filter((s) => s.id !== storyId);
    if (stories.length === data.stories.length) return data;
    return { ...data, stories };
  });

  // Archive grid (infinite cache, different shape from the plain caches above). Deleting
  // from the archive viewer must drop the story here so its grid cell disappears.
  qc.setQueryData<InfiniteData<ArchivedStoriesResponse>>(
    queryKeys.archivedStories(),
    (data) => {
      if (!data) return data;
      let touched = false;
      const pages = data.pages.map((page) => {
        if (!page.stories.some((s) => s.id === storyId)) return page;
        touched = true;
        return { ...page, stories: page.stories.filter((s) => s.id !== storyId) };
      });
      return touched ? { ...data, pages } : data;
    },
  );
}

// Snapshot the caches in onMutate so onError can roll an optimistic update back.
export interface StoryCacheSnapshot {
  feed: StoryFeedResponse | undefined;
  userStories: UserStoriesResponse | undefined;
  userStoriesKey: QueryKey;
  archive: InfiniteData<ArchivedStoriesResponse> | undefined;
}

export function snapshotStoryCaches(
  qc: QueryClient,
  username: string,
): StoryCacheSnapshot {
  return {
    feed: qc.getQueryData<StoryFeedResponse>(queryKeys.storiesFeed()),
    userStories: qc.getQueryData<UserStoriesResponse>(queryKeys.userStories(username)),
    userStoriesKey: queryKeys.userStories(username),
    archive: qc.getQueryData<InfiniteData<ArchivedStoriesResponse>>(queryKeys.archivedStories()),
  };
}

export function restoreStoryCaches(qc: QueryClient, snap: StoryCacheSnapshot): void {
  qc.setQueryData(queryKeys.storiesFeed(), snap.feed);
  qc.setQueryData(snap.userStoriesKey, snap.userStories);
  qc.setQueryData(queryKeys.archivedStories(), snap.archive);
}
