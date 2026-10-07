import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import { conversationsApi, type SendMessageInput } from "@/api/conversations";
import { queryKeys } from "@/api/queryKeys";
import { infiniteList } from "@/api/paging";
import type { Conversation, Message, Paginated } from "@/types/api";
import { uuid } from "@/utils/format";

export type MessagesData = InfiniteData<Paginated<Message>, string | null>;

/** Every chat, page by page (the chats screen). */
export function useAllConversations() {
  return useInfiniteQuery({
    queryKey: [...queryKeys.conversations, "~all"],
    ...infiniteList<Conversation>("/conversations/"),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

/** The most recent chats only — enough for the unread badge in the menu. */
export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations,
    queryFn: conversationsApi.list,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function useConversation(id: string) {
  // Polled so «last seen» and a chat closed by the request being completed show up without a reload.
  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: () => conversationsApi.get(id),
    refetchInterval: 15_000,
  });
}

export function useMessages(id: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.messages(id),
    queryFn: ({ pageParam }) => conversationsApi.messages(id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
  });
}

/** Insert or replace a message in the cache (dedupe by id and client_id). */
export function upsertMessage(data: MessagesData | undefined, message: Message): MessagesData | undefined {
  if (!data) return data;
  let replaced = false;
  const pages = data.pages.map((page) => ({
    ...page,
    results: page.results.map((m) => {
      if (m.id === message.id || (message.client_id && m.client_id === message.client_id)) {
        replaced = true;
        // Keep the local photo preview until the server's copy arrives.
        const attachment = message.attachment ?? m.attachment;
        return {
          ...m,
          ...message,
          attachment,
          pending: message.pending ?? false,
          failed: false,
          uploading: false,
        };
      }
      return m;
    }),
  }));
  if (!replaced && pages[0]) pages[0] = { ...pages[0], results: [message, ...pages[0].results] };
  return { ...data, pages };
}

export function markMessagesRead(data: MessagesData | undefined, ids: string[], readAt: string) {
  if (!data) return data;
  const set = new Set(ids);
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      results: page.results.map((m) => (set.has(m.id) ? { ...m, read_at: readAt } : m)),
    })),
  };
}

export function useSendMessage(conversationId: string, myId: string | undefined) {
  const qc = useQueryClient();
  const key = queryKeys.messages(conversationId);
  return useMutation({
    mutationFn: (input: SendMessageInput) => conversationsApi.send(conversationId, input),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const optimistic: Message = {
        id: `local-${input.client_id}`,
        conversation_id: conversationId,
        sender_id: myId ?? null,
        text: input.text ?? "",
        message_type: input.attachment_id ? "IMAGE" : "TEXT",
        attachment: null,
        client_id: input.client_id,
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
      };
      qc.setQueryData<MessagesData>(key, (data) => upsertMessage(data, optimistic));
    },
    onSuccess: (message) => {
      qc.setQueryData<MessagesData>(key, (data) => upsertMessage(data, message));
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
    },
    onError: (_error, input) => {
      qc.setQueryData<MessagesData>(
        key,
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((p) => ({
              ...p,
              results: p.results.map((m) =>
                m.client_id === input.client_id ? { ...m, pending: false, failed: true } : m,
              ),
            })),
          },
      );
    },
    meta: { inlineErrors: true },
  });
}

/**
 * A photo appears in the chat the moment it is picked (local preview, «uploading»), so the sender sees
 * at once where it goes. Returns helpers to drop it (upload failed) — sending then replaces it.
 */
export function useLocalPhotoMessage(conversationId: string, myId: string | undefined) {
  const qc = useQueryClient();
  const key = queryKeys.messages(conversationId);
  const add = (clientId: string, previewUrl: string) =>
    qc.setQueryData<MessagesData>(key, (data) =>
      upsertMessage(data, {
        id: `local-${clientId}`,
        conversation_id: conversationId,
        sender_id: myId ?? null,
        text: "",
        message_type: "IMAGE",
        attachment: {
          id: clientId,
          url: previewUrl,
          thumbnail_url: previewUrl,
          width: null,
          height: null,
          status: "PENDING",
        },
        client_id: clientId,
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
        uploading: true,
      }),
    );
  const remove = (clientId: string) =>
    qc.setQueryData<MessagesData>(
      key,
      (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            results: p.results.filter((m) => m.client_id !== clientId),
          })),
        },
    );
  return { add, remove };
}

export function useReact(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      conversationsApi.react(conversationId, messageId, emoji),
    onSuccess: (message) =>
      qc.setQueryData<MessagesData>(queryKeys.messages(conversationId), (data) =>
        upsertMessage(data, message),
      ),
  });
}

export function newClientId(): string {
  return uuid();
}

export function useMarkConversationRead(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => conversationsApi.markRead(conversationId),
    onSuccess: () => {
      // Works even if the WebSocket is down: refetch read state and unread counters.
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
      void qc.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
    meta: { inlineErrors: true },
  });
}
