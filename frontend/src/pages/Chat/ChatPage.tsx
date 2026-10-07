import clsx from "clsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { REACTIONS } from "@/api/conversations";
import { mediaApi } from "@/api/media";
import { Avatar, Button, ErrorState, IconButton, Lightbox, Loader } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import {
  newClientId,
  useLocalPhotoMessage,
  useReact,
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
import { CATEGORY_EMOJI } from "@/utils/categories";
import { formatTime } from "@/utils/format";

import styles from "./Chat.module.css";

function MessageBubble({
  message,
  mine,
  onRetry,
  onReport,
  onOpenImage,
  myId,
  otherName,
  selected,
  onSelect,
  onReply,
  onReact,
  onJump,
}: {
  message: Message;
  mine: boolean;
  onRetry: (m: Message) => void;
  onReport: (m: Message) => void;
  onOpenImage: (src: string) => void;
  myId: string | undefined;
  otherName: string;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onReply: (m: Message) => void;
  onReact: (m: Message, emoji: string) => void;
  onJump: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (message.message_type === "SYSTEM") return <div className={styles.system}>{message.text}</div>;
  const local = message.id.startsWith("local-");
  const quote = message.reply_to;
  const reactions = message.reactions ?? [];
  return (
    <div className={clsx(styles.row, mine && styles.rowMine)} id={`m-${message.id}`}>
      <div
        className={clsx(
          styles.bubble,
          mine && styles.mine,
          message.pending && styles.pending,
          message.failed && styles.failed,
          selected && styles.selected,
        )}
        onClick={
          message.failed
            ? () => onRetry(message)
            : local
              ? undefined
              : () => onSelect(selected ? null : message.id)
        }
        onContextMenu={(e) => {
          if (!mine && !message.id.startsWith("local-")) {
            e.preventDefault();
            onReport(message);
          }
        }}
        title={message.failed ? t("chat.failed") : undefined}
      >
        {quote && (
          <button
            type="button"
            className={styles.quote}
            onClick={(e) => {
              e.stopPropagation();
              onJump(quote.id);
            }}
          >
            <strong>{quote.sender_id === myId ? t("chat.you") : otherName}</strong>
            <span>
              {quote.message_type === "IMAGE" && !quote.text ? `📷 ${t("chat.image")}` : quote.text}
            </span>
          </button>
        )}
        {message.attachment?.url && (
          <button
            type="button"
            className={styles.imageButton}
            onClick={(e) => {
              e.stopPropagation();
              onOpenImage(message.attachment!.url!);
            }}
            aria-label={t("chat.image")}
          >
            <img
              className={styles.image}
              src={message.attachment.thumbnail_url ?? message.attachment.url}
              alt=""
            />
            {message.uploading && (
              <span className={styles.uploading} role="status">
                <span className={styles.uploadingSpin} aria-hidden />
                {t("create.uploading")}
              </span>
            )}
          </button>
        )}
        {message.text}
        <span className={styles.time}>
          {formatTime(message.created_at)}
          {mine && !message.pending && !message.failed && (message.read_at ? ` ✓✓ ${t("chat.read")}` : " ✓")}
          {message.failed && ` ⚠ ${t("chat.failed")}`}
        </span>
      </div>
      {reactions.length > 0 && (
        <div className={styles.reactions}>
          {reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              className={clsx(styles.reaction, myId && r.user_ids.includes(myId) && styles.reactionMine)}
              onClick={() => onReact(message, r.emoji)}
              aria-pressed={!!myId && r.user_ids.includes(myId)}
            >
              {r.emoji}
              {r.user_ids.length > 1 && <span>{r.user_ids.length}</span>}
            </button>
          ))}
        </div>
      )}
      {selected && (
        <div className={styles.actions} role="toolbar" aria-label={t("chat.actions")}>
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className={styles.actionEmoji}
              onClick={() => (onReact(message, emoji), onSelect(null))}
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className={styles.actionText}
            onClick={() => (onReply(message), onSelect(null))}
          >
            ↩ {t("chat.reply")}
          </button>
          {!mine && (
            <button
              type="button"
              className={styles.actionText}
              onClick={() => (onReport(message), onSelect(null))}
            >
              🚩
            </button>
          )}
        </div>
      )}
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
  const localPhoto = useLocalPhotoMessage(id, me?.id);
  const [reportMessage, setReportMessage] = useState<Message | null>(null);
  const [openImage, setOpenImage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const react = useReact(id);
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
    send.mutate({
      text: value,
      attachment_id: attachmentId ?? null,
      client_id: clientId,
      reply_to_id: replyTo && !replyTo.id.startsWith("local-") ? replyTo.id : null,
    });
    setReplyTo(null);
  };

  const jumpTo = (messageId: string) => {
    const el = document.getElementById(`m-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add(styles.flash!);
    window.setTimeout(() => el.classList.remove(styles.flash!), 1200);
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
    // Show it in the chat right away, then upload; sending replaces the preview with the real photo.
    const clientId = newClientId();
    const preview = URL.createObjectURL(file);
    localPhoto.add(clientId, preview);
    setUploading(true);
    try {
      const media = await mediaApi.upload(file, "CHAT");
      sendText("", media.id, clientId);
    } catch (error) {
      localPhoto.remove(clientId);
      URL.revokeObjectURL(preview);
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
    : otherOnline || conversation.data.other_online
      ? t("chat.online")
      : t("chat.aboutRequest", { title: conversation.data.help_request.title });

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <IconButton label={t("nav.back")} onClick={() => navigate("/chats")}>
          ←
        </IconButton>
        <Link to={other ? `/profile/${other.id}` : "#"}>
          <Avatar
            name={name}
            media={other?.avatar}
            size={40}
            online={otherOnline || conversation.data.other_online}
          />
        </Link>
        <div className={styles.topInfo}>
          <div className={styles.topName}>{name}</div>
          <div className={styles.topStatus}>{statusLine}</div>
        </div>
        <Link
          to={`/help/${conversation.data.help_request.id}`}
          className={styles.requestLink}
          title={t("chat.aboutRequest", { title: conversation.data.help_request.title })}
        >
          <span aria-hidden>{CATEGORY_EMOJI[conversation.data.help_request.category]}</span>
          {t("chat.request")}
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
              onOpenImage={setOpenImage}
              myId={me?.id}
              otherName={name}
              selected={selectedId === message.id}
              onSelect={setSelectedId}
              onReply={(m) => {
                setReplyTo(m);
                inputRef.current?.focus();
              }}
              onReact={(m, emoji) => react.mutate({ messageId: m.id, emoji })}
              onJump={jumpTo}
            />
          ))
        )}
      </div>
      {conversation.data.is_open && replyTo && (
        <div className={styles.replyBar}>
          <div className={styles.replyBarText}>
            <strong>
              ↩ {t("chat.replyingTo", { name: replyTo.sender_id === me?.id ? t("chat.you") : name })}
            </strong>
            <span>{replyTo.text || `📷 ${t("chat.image")}`}</span>
          </div>
          <IconButton label={t("common.cancel")} onClick={() => setReplyTo(null)}>
            ✕
          </IconButton>
        </div>
      )}
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
            ref={inputRef}
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
      <Lightbox
        images={openImage ? [{ src: openImage, alt: t("chat.image") }] : []}
        index={openImage ? 0 : null}
        onClose={() => setOpenImage(null)}
      />
      <ReportDialog
        open={!!reportMessage}
        onClose={() => setReportMessage(null)}
        target={{ message_id: reportMessage?.id }}
      />
    </div>
  );
}
