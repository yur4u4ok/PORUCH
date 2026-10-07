import type { Conversation, Message, Paginated } from "@/types/api";

import { http } from "./client";

export interface SendMessageInput {
  text?: string;
  attachment_id?: string | null;
  client_id: string;
  reply_to_id?: string | null;
}

export const REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "👌"] as const;

export const conversationsApi = {
  react: (conversationId: string, messageId: string, emoji: string) =>
    http.post<Message>(`/conversations/${conversationId}/messages/${messageId}/reactions/`, { emoji }),
  list: () => http.get<Paginated<Conversation>>("/conversations/"),
  get: (id: string) => http.get<Conversation>(`/conversations/${id}/`),
  messages: (id: string, cursorUrl?: string | null) =>
    http.get<Paginated<Message>>(cursorUrl ?? `/conversations/${id}/messages/`),
  send: (id: string, input: SendMessageInput) => http.post<Message>(`/conversations/${id}/messages/`, input),
  markRead: (id: string) => http.post<{ marked: number }>(`/conversations/${id}/read/`),
};
