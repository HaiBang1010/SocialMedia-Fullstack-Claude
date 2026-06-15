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

// GET /users/groupable (Phase 5.5) — a public user plus where the suggestion came from:
// 'recent' = a recent conversation partner, 'mutual' = a mutual follow.
export interface GroupableUser extends PublicUser {
  source: 'recent' | 'mutual';
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
// Phase 2 IMAGE, 3.2 VIDEO, 5.4b VOICE, 5.4c STICKER/GIF (Giphy-hosted, MessageMedia only).
export type MediaType = 'IMAGE' | 'VIDEO' | 'VOICE' | 'STICKER' | 'GIF';

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
// lastReadMessageId is the member's read cursor — drives the "Seen" indicator (Phase 5.2).
export interface Participant {
  user: PublicUser;
  isAdmin: boolean;
  lastReadMessageId: string | null;
}

// One reaction row on a message (Phase 5.3a, D2: RAW). The client aggregates these into compact
// chips ("👍 3  ❤️ 1") via lib/reactions.groupReactionsByEmoji. One row per (message, user).
export interface MessageReaction {
  userId: string;
  emoji: string;
}

// One image/video attachment on a message (Phase 5.4a). Server WHITELIST — objectKey is never
// exposed. width/height are the ORIGINAL dimensions (drive the IG-style grid aspect / avoid CLS).
// The optional fields below are CLIENT-ONLY (never sent by the server): they live on an optimistic
// message's media while it uploads, driving the per-cell preview + progress / failed overlay.
export interface MessageMedia {
  id: string;
  type: MediaType;
  order: number;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  duration: number | null; // seconds, video only
  localUrl?: string; // object URL for instant optimistic preview
  uploadProgress?: number; // 0–100 during upload
  uploadStatus?: 'uploading' | 'done' | 'failed';
}

// Phase 5.4c — a shared-post preview embedded in a POST_SHARE message. NARROW (not full Post):
// just the card fields. Click-through fetches the full post + re-checks visibility. null when the
// shared post was since deleted (FK SetNull → "Post unavailable").
export interface SharedPostPreview {
  id: string;
  caption: string | null;
  author: Pick<PublicUser, 'id' | 'username' | 'name' | 'avatarUrl'>;
  firstMedia: Pick<PostMedia, 'type' | 'url' | 'thumbnailUrl'> | null;
}

// One message. Returned BARE by POST /conversations/:id/messages and inside the
// messages list. content is null for media-only messages and deleted/recalled ones (5.5).
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  contentType: MessageContentType;
  content: string | null;
  createdAt: string; // ISO
  // Phase 5.5 — recall marker. Non-null = tombstone: content is null, media/reactions/sharedPost
  // empty, and the bubble renders "Message deleted" while holding its slot in the thread.
  deletedAt?: string | null;
  sender: PublicUser;
  reactions: MessageReaction[]; // Phase 5.3a — RAW rows; aggregated client-side for display
  media: MessageMedia[]; // Phase 5.4a — image/video attachments (ordered; [] for text)
  sharedPost?: SharedPostPreview | null; // Phase 5.4c — POST_SHARE only; null otherwise / deleted
  // Client-only (Phase 5.2 T7): set on an optimistic message whose send failed, so the bubble
  // can show a "Failed — tap to retry" affordance. Never sent by the server.
  failed?: boolean;
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

// ── Realtime socket payloads (Phase 5.2) ───────────────────────────────
// Server → Client event payloads (see ARCHITECTURE §5 for the full contract).

export interface MessageNewPayload {
  conversationId: string;
  message: Message;
}

export interface TypingUserPayload {
  conversationId: string;
  userId: string;
  username: string;
  typing: boolean;
}

export interface ReadReceiptPayload {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
}

// Phase 5.3a — a reaction delta. emoji is the new emoji, or null when the user removed theirs.
export interface MessageReactionPayload {
  conversationId: string;
  messageId: string;
  userId: string;
  emoji: string | null;
}

// Phase 5.5 — a recall delta. The client patches its cached message into a "Message deleted"
// tombstone (clears content/media/reactions/sharedPost, sets deletedAt).
export interface MessageDeletedPayload {
  conversationId: string;
  messageId: string;
  deletedAt: string; // ISO
}

export interface PresenceSnapshotPayload {
  online: string[]; // userIds currently online among my partners
  lastSeen: Record<string, string>; // userId -> ISO last-seen, for offline partners
}

export interface PresenceOnlinePayload {
  userId: string;
}

export interface PresenceOfflinePayload {
  userId: string;
  lastSeenAt: string; // ISO
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
    | 'video/mp4'
    | 'audio/webm';
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

// One media attachment in a send-message body (Phase 5.4a). The client uploads the original +
// a thumbnail/poster to MinIO FIRST, then sends these references. objectKey/thumbnailObjectKey
// are persisted server-side for S3 cleanup on recall (5.5); thumbnailUrl required for BOTH types.
export interface MessageMediaInput {
  type: MediaType;
  order: number;
  url: string;
  objectKey?: string; // uploaded media only (image/video/voice); absent for STICKER/GIF (Giphy-hosted, 5.4c)
  thumbnailUrl?: string; // required IMAGE/VIDEO, absent for VOICE/STICKER/GIF (enforced server-side)
  thumbnailObjectKey?: string;
  width?: number;
  height?: number;
  duration?: number; // required for VIDEO/VOICE (enforced server-side)
}

// POST /conversations/:id/messages (Phase 5.4a; 5.4c adds sharedPostId). A message carries an
// optional text caption AND/OR 1..10 media items, OR a shared post. The server derives contentType.
export interface SendMessageInput {
  content?: string;
  media?: MessageMediaInput[];
  sharedPostId?: string; // Phase 5.4c — share a post; exclusive with media, caption allowed
}

// Phase 5.4c — one Giphy result (GET /giphy/search|trending), trimmed server-side.
export interface GiphyItem {
  id: string;
  url: string; // animated GIF/sticker
  previewUrl: string; // still frame
  width: number;
  height: number;
}

// POST /conversations/direct
export interface CreateDirectInput {
  targetUserId: string;
}

// POST /conversations/group — participantIds excludes the creator (added server-side).
// name is OPTIONAL (Phase 5.5): omit/blank → the server auto-derives "Group with X, Y, Z".
export interface CreateGroupInput {
  participantIds: string[];
  name?: string;
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
