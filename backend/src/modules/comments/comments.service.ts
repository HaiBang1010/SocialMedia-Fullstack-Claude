import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import { publicUserSelect } from '../users/users.service';
import { getViewablePost } from '../posts/posts.service';
import { safeNotify } from '../notifications/notifications.service';
import type {
  CreateCommentInput,
  UpdateCommentInput,
  CommentListQuery,
  ReplyListQuery,
} from './comments.schema';

const commentInclude = {
  author: { select: publicUserSelect },
  _count: { select: { replies: true } },
} satisfies Prisma.CommentInclude;

type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

/**
 * Flatten the recursive Prisma row into the wire DTO: `_count.replies` becomes a
 * flat `repliesCount`, Date becomes an ISO string. Mirrors serializePost (posts.service).
 */
function serializeComment(comment: CommentRow) {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    parentId: comment.parentId,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    author: comment.author,
    repliesCount: comment._count.replies,
  };
}

/**
 * Create a comment (or reply) on a post. Requires the viewer can see the post (else 404).
 * Replies are flattened one level: if the parent is itself a reply, the new comment is
 * re-parented to the parent's root, so the DB chain never exceeds one level.
 */
export async function createComment(authorId: string, postId: string, input: CreateCommentInput) {
  const post = await getViewablePost(postId, authorId);

  let parentId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: input.parentId },
      select: { postId: true, parentId: true },
    });
    if (!parent || parent.postId !== postId) {
      throw new AppError(400, 'InvalidParent', 'Parent comment does not belong to this post');
    }
    // Flatten: attach to the parent's root when the parent is already a reply.
    parentId = parent.parentId ?? input.parentId;
  }

  const comment = await prisma.comment.create({
    data: { postId, authorId, parentId, content: input.content },
    include: commentInclude,
  });

  // Notify the POST author (self-skip handled in createNotification). Replies notify the post
  // author too — notifying the parent-comment author is out of scope of the 3 stored types
  // (see BACKLOG); @mention notifications are deferred (Phase polish, no backend parser).
  await safeNotify(post.authorId, {
    type: 'COMMENT',
    actorId: authorId,
    postId,
    commentId: comment.id,
  });

  return serializeComment(comment);
}

/**
 * List a post's ROOT comments, newest first (createdAt desc; older comments load on scroll/click).
 * Each item carries repliesCount. Requires the viewer can see the post (else 404).
 * Cursor = comment id of the previous page's last item.
 */
export async function listComments(postId: string, viewerId: string | undefined, pagination: CommentListQuery) {
  await getViewablePost(postId, viewerId);

  const { cursor, limit } = pagination;

  const rows = await prisma.comment.findMany({
    where: { postId, parentId: null },
    include: commentInclude,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  return { comments: slice.map(serializeComment), nextCursor };
}

/**
 * List a comment's replies, oldest first (chronological — natural thread reading order).
 * Requires the parent exists and the viewer can see its post (else 404).
 * Cursor = reply id of the previous page's last item.
 */
export async function listReplies(commentId: string, viewerId: string | undefined, pagination: ReplyListQuery) {
  const parent = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { postId: true },
  });
  if (!parent) {
    throw new AppError(404, 'CommentNotFound', 'Comment not found');
  }
  await getViewablePost(parent.postId, viewerId);

  const { cursor, limit } = pagination;

  const rows = await prisma.comment.findMany({
    where: { parentId: commentId },
    include: commentInclude,
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? slice[slice.length - 1]!.id : null;

  return { comments: slice.map(serializeComment), nextCursor };
}

/**
 * Edit a comment's content. Only the comment's author may edit (else 403).
 */
export async function updateComment(commentId: string, userId: string, input: UpdateCommentInput) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) {
    throw new AppError(404, 'CommentNotFound', 'Comment not found');
  }
  if (comment.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only edit your own comments');
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content: input.content },
    include: commentInclude,
  });
  return serializeComment(updated);
}

/**
 * Delete a comment. Only the comment's author may delete (Phase 3.3 — was author-or-post-author).
 * Cascade (onDelete: Cascade on the self-relation) removes its replies.
 */
export async function deleteComment(commentId: string, userId: string): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) {
    throw new AppError(404, 'CommentNotFound', 'Comment not found');
  }
  if (comment.authorId !== userId) {
    throw new AppError(403, 'Forbidden', 'You can only delete your own comments');
  }

  await prisma.comment.delete({ where: { id: commentId } });
}
