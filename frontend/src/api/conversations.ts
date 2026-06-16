import { apiClient } from './client';
import type {
  Conversation,
  ConversationListResponse,
  CreateDirectInput,
  CreateGroupInput,
  Message,
  MessagesListResponse,
  PaginationParams,
  SendMessageInput,
  UnreadTotalResponse,
} from '@/types/api';

export const conversationsApi = {
  // POST /conversations/direct → 201, bare Conversation (idempotent on the pair).
  createDirect: async (input: CreateDirectInput): Promise<Conversation> => {
    const { data } = await apiClient.post<Conversation>('/conversations/direct', input);
    return data;
  },

  // POST /conversations/group → 201, bare Conversation.
  createGroup: async (input: CreateGroupInput): Promise<Conversation> => {
    const { data } = await apiClient.post<Conversation>('/conversations/group', input);
    return data;
  },

  // GET /conversations → cursor-paginated list, recent activity first.
  list: async (params?: PaginationParams): Promise<ConversationListResponse> => {
    const { data } = await apiClient.get<ConversationListResponse>('/conversations', { params });
    return data;
  },

  // GET /conversations/unread-total → { total } (nav badge).
  unreadTotal: async (): Promise<UnreadTotalResponse> => {
    const { data } = await apiClient.get<UnreadTotalResponse>('/conversations/unread-total');
    return data;
  },

  // GET /conversations/:id → bare Conversation (participant only; 404 otherwise).
  get: async (id: string): Promise<Conversation> => {
    const { data } = await apiClient.get<Conversation>(`/conversations/${id}`);
    return data;
  },

  // GET /conversations/:id/messages → cursor-paginated, newest-first.
  listMessages: async (id: string, params?: PaginationParams): Promise<MessagesListResponse> => {
    const { data } = await apiClient.get<MessagesListResponse>(
      `/conversations/${id}/messages`,
      { params },
    );
    return data;
  },

  // POST /conversations/:id/messages → 201, bare Message.
  sendMessage: async (id: string, input: SendMessageInput): Promise<Message> => {
    const { data } = await apiClient.post<Message>(`/conversations/${id}/messages`, input);
    return data;
  },
};
