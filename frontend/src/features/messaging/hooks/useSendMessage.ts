import { useMutation, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '@/api';
import { queryKeys } from '@/lib/queryKeys';
import {
  clearMessageFailed,
  insertOptimisticMessage,
  markMessageFailed,
  messageExists,
  patchMessageMediaProgress,
  swapTempMessage,
} from '@/lib/messageCache';
import { patchConversationOnNewMessage } from '@/lib/conversationCache';
import {
  clearPendingAttachments,
  getPendingAttachments,
  uploadAttachments,
} from '@/features/messaging/mediaUpload';
import { isEmojiOnly } from '@/lib/emoji';
import { useAuthStore } from '@/stores/authStore';
import type { Message, MessageContentType, MessageMedia } from '@/types/api';

interface SendMessageVars {
  // Optimistic id of the bubble. Caller generates a fresh `temp-…` for a new send; a RETRY reuses
  // the failed message's id (set isRetry). Any media for this send is stashed in mediaUpload under
  // this same id (see MessageInput / setPendingAttachments).
  tempId: string;
  content?: string;
  isRetry?: boolean;
}

interface SendMessageContext {
  tempId: string | null; // null when not authenticated
}

// Build the optimistic media[] for a temp message from its stashed attachments — local preview
// URLs + an 'uploading' status that drives the per-cell progress overlay (Phase 5.4a).
function optimisticMedia(tempId: string): MessageMedia[] {
  const attachments = getPendingAttachments(tempId) ?? [];
  return attachments.map((a, order) => ({
    id: a.localId,
    type: a.type,
    order,
    url: a.previewUrl,
    thumbnailUrl: a.previewUrl,
    width: a.width ?? null,
    height: a.height ?? null,
    duration: a.duration ?? null,
    localUrl: a.previewUrl,
    uploadProgress: 0,
    uploadStatus: 'uploading',
  }));
}

// Send a message — text, image/video media (1..10, mix allowed), or both — with an optimistic
// insert. Media uploads run inside the mutation (pool of 3), patching per-item progress into the
// temp bubble. On success the temp swaps for the server's real message; on FAILURE the bubble is
// kept and marked `failed` (NOT rolled back) so the user can tap to retry — a retry resumes,
// re-uploading only the items that hadn't finished (Phase 5.2 T7 + 5.4a).
export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);

  return useMutation<Message, Error, SendMessageVars, SendMessageContext>({
    mutationFn: async ({ tempId, content }) => {
      const attachments = getPendingAttachments(tempId) ?? [];
      let media;
      if (attachments.length > 0) {
        media = await uploadAttachments(attachments, (order, progress, status) =>
          patchMessageMediaProgress(qc, conversationId, tempId, order, progress, status),
        );
      }
      return conversationsApi.sendMessage(conversationId, { content: content || undefined, media });
    },

    onMutate: async ({ tempId, content, isRetry }) => {
      await qc.cancelQueries({ queryKey: queryKeys.messages(conversationId) });

      // Retry: clear the failed flag, and reset still-unfinished media items to the uploading
      // overlay (finished ones keep their `uploaded` ref and re-show as done).
      if (isRetry) {
        clearMessageFailed(qc, conversationId, tempId);
        const attachments = getPendingAttachments(tempId) ?? [];
        attachments.forEach((a, order) => {
          if (!a.uploaded) patchMessageMediaProgress(qc, conversationId, tempId, order, 0, 'uploading');
        });
        return { tempId };
      }

      if (!me) return { tempId: null };

      const media = optimisticMedia(tempId);
      // Mirror the server's derive (messages.service) so the optimistic bubble matches the real
      // one — important for EMOJI (giant render) which would otherwise flicker normal→giant on swap.
      const contentType: MessageContentType =
        media.length === 0
          ? isEmojiOnly(content)
            ? 'EMOJI'
            : 'TEXT'
          : media.every((m) => m.type === 'VOICE')
            ? 'VOICE'
            : media.every((m) => m.type === 'STICKER')
              ? 'STICKER'
              : media.every((m) => m.type === 'GIF')
                ? 'GIF'
                : media.every((m) => m.type === 'VIDEO')
                  ? 'VIDEO'
                  : 'IMAGE';

      const optimistic: Message = {
        id: tempId,
        conversationId,
        senderId: me.id,
        contentType,
        content: content && content.length > 0 ? content : null,
        createdAt: new Date().toISOString(),
        sender: me,
        reactions: [],
        media,
      };
      insertOptimisticMessage(qc, conversationId, optimistic);
      return { tempId };
    },

    onError: (_err, _vars, ctx) => {
      // T7: do NOT roll back. Keep the bubble on screen, marked failed, so it can be retried.
      if (ctx?.tempId) markMessageFailed(qc, conversationId, ctx.tempId);
    },

    onSuccess: (data, _vars, ctx) => {
      // Swap the temp message for the server's real one + release the preview object URLs. If the
      // temp wasn't swapped, the socket echo (message:new) may have reconciled it — only refetch
      // when the real message genuinely isn't in cache.
      const swapped = ctx?.tempId ? swapTempMessage(qc, conversationId, ctx.tempId, data) : false;
      if (ctx?.tempId) clearPendingAttachments(ctx.tempId);
      if (!swapped && !messageExists(qc, conversationId, data.id)) {
        qc.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      }
      // Move-to-top + preview in the conversation list (idempotent with the socket echo).
      patchConversationOnNewMessage(qc, conversationId, data);
    },
  });
}
