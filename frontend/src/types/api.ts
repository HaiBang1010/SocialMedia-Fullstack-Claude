// Hand-written API types. Must match backend response shapes 1:1.
// Backend reference: backend/src/modules/{auth,users,posts,feed,comments,likes,follows,media}/*.schema.ts
//
// Envelope note: Phase 1 (auth/users) WRAPS single resources as `{ user }`.
// Phase 2 (posts/comments) returns the resource BARE (no wrapper). List
// endpoints return an object `{ <items>, nextCursor }`. DELETE → 204 (void).

// ── Users ──────────────────────────────────────────────────────────────

// Public user shape — mirrors backend `publicUserSelect` / publicUserSchema
// (no email / passwordHash). Reused as post.author, comment.author, and
// follower/following list items.
export interface PublicUser {
  id: string;
  username: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  isPrivate: boolean;
  createdAt: string; // ISO
}

// Authenticated self. Adds `email`, present only on own-profile responses
// (GET /auth/me, PATCH /users/me).
export interface User extends PublicUser {
  email?: string;
}

// Public profile DTO — only GET /users/:username returns this. PublicUser + social
// counts + the viewer's follow relationship. Kept separate from PublicUser so the
// lean 7-field shape (post.author / comment.author / list items) doesn't bloat.
// isFollowing: null for an anonymous viewer or self; true/false for a logged-in
// non-self viewer. postsCount mirrors what the profile grid actually shows.
export interface ProfileUser extends PublicUser {
  postsCount: number;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean | null;
  hasActiveStory: boolean; // Phase 4.4 — story ring on the profile avatar
}

// ── Auth ───────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// POST /auth/register, POST /auth/login
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// POST /auth/refresh — only a new access token, refresh token unchanged.
export interface RefreshResponse {
  accessToken: string;
}

// GET /auth/me, PATCH /users/me — Phase 1 wraps `{ user }` (self, may include email).
export interface UserResponse {
  user: User;
}

// GET /users/:username — wraps the public profile DTO. Also `{ user }`, but the
// user is a ProfileUser (counts + isFollowing), not the self User.
export interface ProfileResponse {
  user: ProfileUser;
}

// ── Posts ──────────────────────────────────────────────────────────────

export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type MediaType = 'IMAGE' | 'VIDEO'; // Phase 2 only produces IMAGE

// Item inside post.media (mirrors postMediaSchema).
export interface PostMedia {
  id: string;
  type: MediaType;
  url: string;
  thumbnailUrl: string | null; // video poster, null for images
  duration: number | null; // video length in seconds, null for images
  width: number | null;
  height: number | null;
  order: number;
}

// GET /posts/:id, POST /posts, PATCH /posts/:id — returned BARE (no wrapper).
// Includes the 4 social fields from serializePost.
export interface Post {
  id: string;
  authorId: string;
  caption: string | null;
  visibility: PostVisibility;
  createdAt: string; // ISO
  author: PublicUser;
  media: PostMedia[];
  likesCount: number;
  commentsCount: number;
  isLikedByMe: boolean;
  isFollowingAuthor: boolean;
}

// GET /users/:username/posts
export interface PostListResponse {
  posts: Post[];
  nextCursor: string | null;
}

// GET /feed — same shape as PostListResponse, kept distinct to match the wire.
export interface FeedResponse {
  posts: Post[];
  nextCursor: string | null;
}

// ── Comments ───────────────────────────────────────────────────────────

// POST /posts/:id/comments, PATCH /comments/:id — returned BARE.
// parentId is null for root comments, the root comment id for replies (Phase 3.3
// flattens one level). repliesCount is 0 for replies (no nesting beyond level 1).
export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  content: string;
  createdAt: string; // ISO
  author: PublicUser;
  repliesCount: number;
}

// Shared by GET /posts/:id/comments (root, newest-first) and
// GET /comments/:id/replies (replies, chronological). Same envelope.
export interface CommentListResponse {
  comments: Comment[];
  nextCursor: string | null;
}

// ── Story overlays (Phase 4.3a) ────────────────────────────────────────

// Draggable layers on a story. x/y are 0-1 normalized against the story content zone;
// scale/rotation are persisted but always 1/0 in 4.3a (multi-touch lands in 4.3b). The
// backend enum also carries MENTION/STICKER/TAG, but only TEXT + EMOJI render in 4.3a.
export type StoryItemType = 'TEXT' | 'EMOJI';

interface StoryItemBase {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export type StoryItem =
  | (StoryItemBase & { id: string; type: 'TEXT'; payload: { text: string } })
  | (StoryItemBase & { id: string; type: 'EMOJI'; payload: { emoji: string } });

// Frontend-built overlay before upload — no id (the DB assigns it on create).
export type StoryItemInput =
  | (StoryItemBase & { type: 'TEXT'; payload: { text: string } })
  | (StoryItemBase & { type: 'EMOJI'; payload: { emoji: string } });

// ── Stories (Phase 4.1) ────────────────────────────────────────────────

// One story = ONE media (flat fields, no media[] like Post). Mirrors backend
// storyResponseSchema. Returned bare by POST /stories and inside the feed / user
// lists. isViewedByMe drives the viewer's start index + the ring color.
export interface Story {
  id: string;
  authorId: string;
  mediaUrl: string;
  mediaType: MediaType;
  thumbnailUrl: string | null; // video poster, null for images
  duration: number | null; // video seconds, null for images
  width: number | null;
  height: number | null;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  author: PublicUser;
  isViewedByMe: boolean;
  items: StoryItem[]; // Phase 4.3a overlays ([] for 4.1/4.2 stories)
  viewCount: number | null; // Phase 4.4 — owner-only; null for non-owners (no leak)
}

// GET /stories/feed — active stories of followed users, grouped by author.
export interface StoryFeedItem {
  user: PublicUser;
  stories: Story[];
  hasUnseenStory: boolean;
}

export interface StoryFeedResponse {
  items: StoryFeedItem[];
}

// GET /users/:username/stories — one user's active stories.
export interface UserStoriesResponse {
  stories: Story[];
}

// GET /stories/archive — the viewer's own archived stories, cursor-paginated.
export interface ArchivedStoriesResponse {
  stories: Story[];
  nextCursor: string | null;
}

// GET /stories/:id/views — one viewer entry (owner-only list).
export interface ViewerEntry {
  user: PublicUser;
  viewedAt: string; // ISO
}

export interface ViewersListResponse {
  viewers: ViewerEntry[];
  nextCursor: string | null;
}

// ── Messaging (Phase 5.1) ──────────────────────────────────────────────

export type ConversationType = 'DIRECT' | 'GROUP';

// Full enum mirrors the backend, but Phase 5.1 only ever sends/receives TEXT.
export type MessageContentType =
  | 'TEXT'
  | 'EMOJI'
  | 'POST_SHARE'
  | 'VOICE'
  | 'IMAGE'
  | 'VIDEO'
  | 'STICKER'
  | 'GIF';

// A conversation member, as returned inside a Conversation (user + admin flag).
export interface Participant {
  user: PublicUser;
  isAdmin: boolean;
}

// One message. Returned BARE by POST /conversations/:id/messages and inside the
// messages list. content is null only for deleted/recalled messages (Phase 5.5).
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  contentType: MessageContentType;
  content: string | null;
  createdAt: string; // ISO
  sender: PublicUser;
}

// A DIRECT (1-1) or GROUP conversation. name/avatarUrl are GROUP-only. lastMessage is
// the newest non-deleted message (null for a brand-new group with no messages yet).
export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatarUrl: string | null;
  createdAt: string; // ISO
  lastMessageAt: string; // ISO — drives list ordering
  participants: Participant[];
  lastMessage: Message | null;
}

// GET /conversations — recent activity first, cursor-paginated.
export interface ConversationListResponse {
  conversations: Conversation[];
  nextCursor: string | null;
}

// GET /conversations/:id/messages — newest-first, cursor-paginated.
export interface MessagesListResponse {
  messages: Message[];
  nextCursor: string | null;
}

// ── Likes / Follows ────────────────────────────────────────────────────

// POST/DELETE /posts/:id/like
export interface LikeResponse {
  liked: boolean;
  likesCount: number;
}

// POST/DELETE /users/:username/follow
export interface FollowResponse {
  following: boolean;
}

// GET /users/:username/followers, GET /users/:username/following
export interface UserListResponse {
  users: PublicUser[];
  nextCursor: string | null;
}

// ── Media (presigned upload) ───────────────────────────────────────────

// POST /media/presign — request. contentType union must stay in sync with
// the backend enum; size in bytes, backend cap is 10MB for images, 50MB for video.
export interface PresignRequest {
  contentType:
    | 'image/jpeg'
    | 'image/png'
    | 'image/webp'
    | 'image/gif'
    | 'image/avif'
    | 'video/mp4';
  size: number;
}

// POST /media/presign — response.
export interface PresignResponse {
  uploadUrl: string; // presigned PUT URL (client uploads the file here)
  publicUrl: string; // URL to serve the object after upload
  objectKey: string; // key to persist with the post
  expiresIn: number; // seconds until uploadUrl expires
}

// ── Request inputs (mirror backend Zod input schemas) ──────────────────

// Media attached when creating a post (client already uploaded to S3).
export interface MediaInput {
  type?: MediaType; // backend defaults to IMAGE
  url: string;
  objectKey: string;
  thumbnailUrl?: string; // video poster URL (after uploading the poster)
  thumbnailObjectKey?: string; // poster S3 key, for deletePost cleanup
  duration?: number; // video length in seconds
  width?: number;
  height?: number;
}

// POST /posts — caption and/or media (backend requires at least one).
export interface CreatePostInput {
  caption?: string;
  visibility?: PostVisibility; // backend defaults to PUBLIC
  media?: MediaInput[]; // Phase 3.1: carousel, max 5
}

// PATCH /posts/:id
export interface UpdatePostInput {
  caption?: string;
  visibility?: PostVisibility;
}

// POST /stories — one media item (client already uploaded to S3). No caption.
export interface CreateStoryInput {
  mediaType?: MediaType; // backend defaults to IMAGE
  mediaUrl: string;
  mediaObjectKey: string;
  thumbnailUrl?: string; // video poster URL
  thumbnailObjectKey?: string; // poster S3 key, for deleteStory cleanup
  duration?: number; // video length in seconds
  width?: number;
  height?: number;
  items?: StoryItemInput[]; // Phase 4.3a overlays (image stories only); backend defaults to []
}

// POST /posts/:id/comments
export interface CreateCommentInput {
  content: string;
  parentId?: string;
}

// PATCH /comments/:id
export interface UpdateCommentInput {
  content: string;
}

// POST /conversations/:id/messages — Phase 5.1 is TEXT-only.
export interface SendMessageInput {
  contentType: 'TEXT';
  content: string;
}

// POST /conversations/direct
export interface CreateDirectInput {
  targetUserId: string;
}

// POST /conversations/group — participantIds excludes the creator (added server-side).
export interface CreateGroupInput {
  participantIds: string[];
  name: string;
}

// Cursor pagination query params, shared by all list endpoints.
export interface PaginationParams {
  cursor?: string;
  limit?: number;
}

// ── Errors ─────────────────────────────────────────────────────────────

// Standard error body from backend middleware/error.ts.
// Note: backend names the code field "error", not "code".
export interface ApiError {
  error: string;
  message: string;
}

// Zod validation failures from middleware/validate.ts.
// details = ZodError.flatten().fieldErrors → field name → messages.
export interface ValidationError extends ApiError {
  error: 'ValidationError';
  details: Record<string, string[] | undefined>;
}
