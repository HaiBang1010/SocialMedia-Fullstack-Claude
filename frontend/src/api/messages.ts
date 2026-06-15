import { apiClient } from './client';
import type { Message } from '@/types/api';

// Phase 5.3a — standalone /messages endpoints (parity with the backend messages.routes module).
// Per-conversation message ops (list/send) live in conversationsApi; these are message-scoped.
export const messagesApi = {
  // POST /messages/:id/reactions → 200, full updated Message (with reactions).
  reactToMessage: async (messageId: string, emoji: string): Promise<Message> => {
    const { data } = await apiClient.post<Message>(`/messages/${messageId}/reactions`, { emoji });
    return data;
  },

  // DELETE /messages/:id/reactions → 200, full updated Message (caller's reaction removed).
  removeReaction: async (messageId: string): Promise<Message> => {
    const { data } = await apiClient.delete<Message>(`/messages/${messageId}/reactions`);
    return data;
  },

  // DELETE /messages/:id → 200, the tombstone Message (recall, Phase 5.5). Sender only (403),
  // 404 if missing, 410 once the 15-minute window has elapsed.
  recallMessage: async (messageId: string): Promise<Message> => {
    const { data } = await apiClient.delete<Message>(`/messages/${messageId}`);
    return data;
  },
};
