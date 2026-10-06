import clsx from "clsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { mediaApi } from "@/api/media";
import { Avatar, Button, ErrorState, IconButton, Loader } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import {
  newClientId,
  useConversation,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
} from "@/features/chat/hooks";
import { useConversationSocket } from "@/features/chat/useConversationSocket";
import { ReportDialog } from "@/features/help/components";
import { usePublicConfig } from "@/features/profile/hooks";
import { toast } from "@/stores/toastStore";
import type { Message } from "@/types/api";
import { uploadErrorMessage, validateImageFile } from "@/utils/files";
import { formatTime } from "@/utils/format";

import styles from "./Chat.module.css";

function MessageBubble({
  message,
  mine,
  onRetry,
  onReport,
}: {
  message: Message;
  mine: boolean;
  onRetry: (m: Message) => void;
  onReport: (m: Message) => void;
}) {
  const { t } = useTranslation();
  if (message.message_type === "SYSTEM") return <div className={styles.system}>{message.text}</div>;
  return (
    <div
      className={clsx(
        styles.bubble,
        mine && styles.mine,
        message.pending && styles.pending,
        message.failed && styles.failed,
      )}
      onClick={message.failed ? () => onRetry(message) : undefined}
      onContextMenu={(e) => {
        if (!mine && !message.id.startsWith("local-")) {
          e.preventDefault();
          onReport(message);
        }
      }}
      title={message.failed ? t("chat.failed") : undefined}
    >
      {message.attachment?.url && (
        <a href={message.attachment.url} target="_blank" rel="noreferrer">
          <img
            className={styles.image}
            src={message.attachment.thumbnail_url ?? message.attachment.url}
            alt={t("chat.image")}
          />
        </a>
      )}
      {message.text}
      <span className={styles.time}>
        {formatTime(message.created_at)}
        {mine && !message.pending && !message.failed && (message.read_at ? ` ✓✓ ${t("chat.read")}` : " ✓")}
        {message.failed && ` ⚠ ${t("chat.failed")}`}
      </span>
    </div>
  );
}

export default function ChatPage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: config } = usePublicConfig();
  const conversation = useConversation(id);
  const messages = useMessages(id);
  const send = useSendMessage(id, me?.id);
  const markRead = useMarkConversationRead(id);
  const { status, otherTyping, otherOnline, notifyTyping } = useConversationSocket(id, me?.id);
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [reportMessage, setReportMessage] = useState<Message | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typingRef = useRef<number | undefined>(undefined);

  // Oldest → newest for display.
  const ordered = useMemo(() => {
    const all = messages.data?.pages.flatMap((p) => p.results) ?? [];
    return [...all].reverse();
  }, [messages.data]);

  // Newest incoming unread message: whenever it changes while the chat is visible, mark as read.
  const latestUnreadId = useMemo(
    () => [...ordered].reverse().find((m) => m.sender_id && m.sender_id !== me?.id && !m.read_at)?.id,
    [ordered, me?.id],
  );

  useEffect(() => {
    if (!latestUnreadId) return;
    const mark = () => document.visibilityState === "visible" && markRead.mutate();
    mark();
    document.addEventListener("visibilitychange", mark);
    return () => document.removeEventListener("visibilitychange", mark);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestUnreadId]);

  useLayoutEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [ordered.length]);

  const sendText = (value: string, attachmentId?: string, clientId = newClientId()) => {
    send.mutate({ text: value, attachment_id: attachmentId ?? null, client_id: clientId });
  };

  const onSubmit = () => {
    const value = text.trim();
    if (!value) return;
    sendText(value);
    setText("");
    notifyTyping(false);
  };

  const onType = (value: string) => {
    setText(value);
    if (!typingRef.current) notifyTyping(true);
    window.clearTimeout(typingRef.current);
    typingRef.current = window.setTimeout(() => {
      notifyTyping(false);
      typingRef.current = undefined;
    }, 3000);
  };

  const onAttach = async (file: File | undefined) => {
    if (!file) return;
    const maxBytes = config?.max_upload_bytes ?? 10 * 1024 * 1024;
    const mb = Math.round(maxBytes / (1024 * 1024));
    const problem = validateImageFile(
      file,
      config?.allowed_image_types ?? ["image/jpeg", "image/png", "image/webp"],
      maxBytes,
    );
    if (problem) {
      toast.error(problem === "type" ? t("create.photoWrongType") : t("create.photoTooLarge", { mb }));
      return;
    }
    setUploading(true);
    try {
      const media = await mediaApi.upload(file, "CHAT");
      sendText("", media.id);
    } catch (error) {
      const [key, params] = uploadErrorMessage(error, mb);
      toast.error(t(key, params));
    } finally {
      setUploading(false);
    }
  };

  if (conversation.isPending) return <Loader />;
  if (conversation.isError) return <ErrorState onRetry={() => void conversation.refetch()} />;

  const other = conversation.data.other_participant;
  const name = other?.display_name ?? t("common.anonymous");
  const statusLine = otherTyping
    ? t("chat.typing")
    : otherOnline
      ? t("chat.online")
      : t("chat.aboutRequest", { title: conversation.data.help_request.title });

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <IconButton label={t("nav.back")} onClick={() => navigate("/chats")}>
          ←
        </IconButton>
        <Link to={other ? `/profile/${other.id}` : "#"}>
          <Avatar name={name} media={other?.avatar} size={40} />
        </Link>
        <div className={styles.topInfo}>
          <div className={styles.topName}>{name}</div>
          <div className={styles.topStatus}>{statusLine}</div>
        </div>
        <Link to={`/help/${conversation.data.help_request.id}`}>
          <Button variant="ghost" size="sm">
            📄
          </Button>
        </Link>
      </header>
      {(status === "reconnecting" || status === "offline") && (
        <div className={styles.banner} role="status">
          {status === "offline" ? t("app.offline") : t("chat.reconnecting")}
        </div>
      )}
      <div ref={listRef} className={styles.list} aria-live="polite">
        {messages.hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void messages.fetchNextPage()}
            loading={messages.isFetchingNextPage}
          >
            {t("chat.loadOlder")}
          </Button>
        )}
        {messages.isPending ? (
          <Loader />
        ) : messages.isError ? (
          <ErrorState onRetry={() => void messages.refetch()} />
        ) : (
          ordered.map((message) => (
            <MessageBubble
              key={message.client_id ?? message.id}
              message={message}
              mine={message.sender_id === me?.id}
              onRetry={(m) => sendText(m.text, m.attachment?.id, m.client_id ?? newClientId())}
              onReport={setReportMessage}
            />
          ))
        )}
      </div>
      {conversation.data.is_open ? (
        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className={styles.attach} aria-label={t("chat.attach")} title={t("chat.attach")}>
            {uploading ? "⏳" : "📷"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="visually-hidden"
              disabled={uploading}
              onChange={(e) => {
                void onAttach(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <textarea
            className={styles.input}
            rows={1}
            maxLength={3000}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            value={text}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />
          <button type="submit" className={styles.send} aria-label={t("chat.send")} disabled={!text.trim()}>
            ➤
          </button>
        </form>
      ) : (
        <div className={styles.closed}>{t("chat.closed")}</div>
      )}
      <ReportDialog
        open={!!reportMessage}
        onClose={() => setReportMessage(null)}
        target={{ message_id: reportMessage?.id }}
      />
    </div>
  );
}
