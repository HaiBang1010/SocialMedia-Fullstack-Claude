import { z } from 'zod';
import { MediaType, StoryItemType } from '@prisma/client';

// ── Story overlay items (Phase 4.3a: TEXT + EMOJI) ──────────────────────
// One draggable overlay layer. x/y are 0-1 normalized against the story content zone;
// scale/rotation are stored (defaults 1/0) but not user-editable until 4.3b. payload is
// a small per-type JSON blob. The Postgres enum already carries MENTION/STICKER/TAG, but
// the input below GATES to TEXT + EMOJI — 4.3b just adds discriminated cases, no migration.
const overlayBaseShape = {
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  scale: z.number().positive().default(1),
  rotation: z.number().default(0),
};

const textItemInputSchema = z.object({
  type: z.literal('TEXT'),
  ...overlayBaseShape,
  payload: z.object({ text: z.string().min(1).max(200) }),
});

const emojiItemInputSchema = z.object({
  type: z.literal('EMOJI'),
  ...overlayBaseShape,
  payload: z.object({ emoji: z.string().min(1).max(8) }),
});

// Music Story — a draggable music sticker. payload carries the chosen iTunes track plus the
// trim window (startMs..startMs+clipMs over the 30s preview). clipMs is the single source of
// truth for the story's duration (the viewer's progress bar reads it; backend does NOT touch
// Story.duration). Cross-field bound (startMs + clipMs <= 30000) is enforced in createStorySchema
// below — discriminatedUnion members must be plain ZodObjects (no .refine wrapper here).
const musicItemInputSchema = z.object({
  type: z.literal('MUSIC'),
  ...overlayBaseShape,
  payload: z.object({
    trackId: z.string().min(1),
    previewUrl: z.string().url(),
    title: z.string().min(1).max(200),
    artist: z.string().min(1).max(200),
    albumArt: z.string().url(),
    startMs: z.number().int().min(0).max(29000),
    clipMs: z.number().int().min(5000).max(30000),
  }),
});

export const storyItemInputSchema = z.discriminatedUnion('type', [
  textItemInputSchema,
  emojiItemInputSchema,
  musicItemInputSchema,
]);

// Response shape for one persisted overlay (adds the DB-assigned id). payload kept loose
// here (doc only) — the runtime serializer whitelists the real per-type shape.
export const storyItemResponseSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(StoryItemType),
  x: z.number(),
  y: z.number(),
  scale: z.number(),
  rotation: z.number(),
  payload: z.record(z.string(), z.unknown()),
});

/**
 * Body for POST /stories. One story = ONE media item (image or video) — fields are
 * flat (no media[] array like posts). The client already uploaded the file to S3
 * (presign at /media/presign) and passes back the url + objectKey it received.
 * Backend does NOT verify the object exists (trusts the client, mirroring posts).
 * No caption in Phase 4.1.
 */
export const createStorySchema = z
  .object({
    mediaType: z.nativeEnum(MediaType).default('IMAGE'),
    mediaUrl: z.string().url(),
    mediaObjectKey: z.string().min(1),
    // Video only: poster image extracted client-side, uploaded as JPEG.
    // thumbnailObjectKey lets deleteStory clean the poster up alongside the video.
    thumbnailUrl: z.string().url().optional(),
    thumbnailObjectKey: z.string().min(1).optional(),
    duration: z.number().int().positive().optional(), // video length in seconds
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    // Phase 4.3a — overlays (text/emoji). Optional + default [] keeps 4.1 clients working.
    // No hard cap here (a soft >20 warning lives in the editor UX).
    items: z.array(storyItemInputSchema).default([]),
  })
  // A video story must carry a poster so the ring/preview has something to show.
  .refine(
    (data) =>
      data.mediaType !== 'VIDEO' || (!!data.thumbnailUrl && !!data.thumbnailObjectKey),
    { message: 'A video story requires a thumbnail' },
  )
  // Music Story constraints: at most ONE music item per story, and the trim window must fit
  // inside the 30s preview. (Per-field bounds live in musicItemInputSchema; this is the
  // cross-field + cardinality guard.)
  .superRefine((data, ctx) => {
    const music = data.items.filter((i) => i.type === 'MUSIC');
    if (music.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items'],
        message: 'A story can have at most one music item',
      });
    }
    for (const [idx, item] of data.items.entries()) {
      if (item.type === 'MUSIC' && item.payload.startMs + item.payload.clipMs > 30000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', idx, 'payload', 'clipMs'],
          message: 'Trim window must fit within the 30s preview (startMs + clipMs <= 30000)',
        });
      }
    }
  });

// ── Response shapes (cho OpenAPI doc) ──
// author dùng đúng các field của publicUserSelect (loại email/passwordHash).
const storyAuthorSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isPrivate: z.boolean(),
  createdAt: z.string(),
});

export const storyResponseSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  mediaUrl: z.string().url(),
  mediaType: z.nativeEnum(MediaType),
  thumbnailUrl: z.string().url().nullable(),
  duration: z.number().int().nullable(), // video seconds, null for images
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  createdAt: z.string(), // ISO
  expiresAt: z.string(), // ISO
  author: storyAuthorSchema,
  isViewedByMe: z.boolean(),
  items: z.array(storyItemResponseSchema), // Phase 4.3a overlays ([] for 4.1/4.2 stories)
  // Phase 4.4 — owner-only view count; null for non-owners (no leak).
  viewCount: z.number().nullable(),
});

// GET /stories/feed — active stories of followed users, grouped by author.
export const storyFeedItemSchema = z.object({
  user: storyAuthorSchema,
  stories: z.array(storyResponseSchema),
  hasUnseenStory: z.boolean(),
});

export const storyFeedResponseSchema = z.object({
  items: z.array(storyFeedItemSchema),
});

// GET /users/:username/stories — one user's active stories.
export const userStoriesResponseSchema = z.object({
  stories: z.array(storyResponseSchema),
});

// GET /stories/archive — the viewer's own archived (expired) stories, cursor-paginated.
export const archivedStoriesResponseSchema = z.object({
  stories: z.array(storyResponseSchema),
  nextCursor: z.string().nullable(),
});

// GET /stories/:id/views — one viewer entry (who saw the story, and when).
export const viewerEntrySchema = z.object({
  user: storyAuthorSchema,
  viewedAt: z.string(), // ISO
});

export const viewersListResponseSchema = z.object({
  viewers: z.array(viewerEntrySchema),
  nextCursor: z.string().nullable(),
});

export type CreateStoryInput = z.infer<typeof createStorySchema>;
