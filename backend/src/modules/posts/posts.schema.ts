import { z } from 'zod';
import { PostVisibility, MediaType } from '@prisma/client';

/**
 * Media kèm theo khi tạo post. Client đã upload file lên S3 (presign ở /media/presign)
 * và truyền lại url + objectKey nhận được. Backend KHÔNG verify file tồn tại (tin client).
 */
const mediaInputSchema = z.object({
  type: z.nativeEnum(MediaType).default('IMAGE'),
  url: z.string().url(),
  objectKey: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const createPostSchema = z
  .object({
    caption: z.string().max(2200).optional(), // IG caption limit ~2200
    visibility: z.nativeEnum(PostVisibility).default('PUBLIC'),
    media: z.array(mediaInputSchema).max(5).default([]), // Phase 3.1: carousel up to 5 images
  })
  .refine(
    (data) => (data.caption?.trim()?.length ?? 0) > 0 || data.media.length > 0,
    { message: 'Post must have caption or at least one media' },
  );

export const updatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  visibility: z.nativeEnum(PostVisibility).optional(),
});

export const paginationSchema = z.object({
  cursor: z.string().optional(), // post id của item cuối trang trước
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ── Response shapes (cho OpenAPI doc) ──
export const postMediaSchema = z.object({
  id: z.string(),
  type: z.nativeEnum(MediaType),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  order: z.number().int(),
});

// author dùng đúng các field của publicUserSelect (loại email/passwordHash)
export const postResponseSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  caption: z.string().nullable(),
  visibility: z.nativeEnum(PostVisibility),
  createdAt: z.string(), // ISO
  author: z.object({
    id: z.string(),
    username: z.string(),
    name: z.string(),
    bio: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    isPrivate: z.boolean(),
    createdAt: z.string(),
  }),
  media: z.array(postMediaSchema),
  likesCount: z.number().int(),
  commentsCount: z.number().int(),
  isLikedByMe: z.boolean(),
  isFollowingAuthor: z.boolean(),
});

export const postListResponseSchema = z.object({
  posts: z.array(postResponseSchema),
  nextCursor: z.string().nullable(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
