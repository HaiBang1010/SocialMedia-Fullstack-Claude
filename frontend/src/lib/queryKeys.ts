// Central query-key factory for TanStack Query. One source of truth so cache
// reads, invalidation, and (Phase 2.4b) optimistic updates all agree on keys.
//
// Keys are hierarchical to enable prefix invalidation, e.g.
//   queryClient.invalidateQueries({ queryKey: ['posts'] })  // all post data
//   queryClient.invalidateQueries({ queryKey: queryKeys.post(id) }) // one post
//
// `as const` keeps each key a readonly literal tuple for type-safe matching.
export const queryKeys = {
  // Current authenticated user (GET /auth/me).
  me: () => ['me'] as const,

  // Public profile (GET /users/:username).
  user: (username: string) => ['users', username] as const,

  // A user's posts (GET /users/:username/posts).
  userPosts: (username: string) => ['users', username, 'posts'] as const,

  // Follower / following lists (GET /users/:username/{followers,following}).
  followers: (username: string) => ['users', username, 'followers'] as const,
  following: (username: string) => ['users', username, 'following'] as const,

  // Users addable to a new group (GET /users/groupable), keyed by search query (Phase 5.5).
  groupableUsers: (q: string) => ['users', 'groupable', q] as const,

  // Personalized feed (GET /feed).
  feed: () => ['feed'] as const,

  // Single post (GET /posts/:id).
  post: (id: string) => ['posts', id] as const,

  // A post's root comments (GET /posts/:id/comments).
  comments: (postId: string) => ['posts', postId, 'comments'] as const,

  // A comment's replies (GET /comments/:id/replies).
  replies: (commentId: string) => ['comments', commentId, 'replies'] as const,

  // Stories feed (GET /stories/feed) — active stories grouped by author.
  storiesFeed: () => ['stories', 'feed'] as const,

  // A user's active stories (GET /users/:username/stories).
  userStories: (username: string) => ['users', username, 'stories'] as const,

  // The current user's archived stories (GET /stories/archive).
  archivedStories: () => ['stories', 'archive'] as const,

  // A story's viewers (GET /stories/:id/views).
  storyViewers: (storyId: string) => ['stories', storyId, 'views'] as const,

  // The viewer's conversations (GET /conversations).
  conversations: () => ['conversations'] as const,

  // A single conversation (GET /conversations/:id).
  conversation: (id: string) => ['conversations', id] as const,

  // A conversation's messages (GET /conversations/:id/messages).
  messages: (conversationId: string) => ['conversations', conversationId, 'messages'] as const,
};
