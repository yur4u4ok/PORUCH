import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/AppLayout";
import { Avatar, Badge, Card, EmptyState, ErrorState, SkeletonList } from "@/components/ui";
import { useConversations } from "@/features/chat/hooks";
import { CATEGORY_EMOJI } from "@/utils/categories";
import { timeAgo } from "@/utils/format";

import styles from "../HelpRequest/HelpRequest.module.css";

export default function ConversationsPage() {
  const { t } = useTranslation();
  const query = useConversations();
  return (
    <main className="page stack">
      <PageHeader title={t("chat.title")} back={false} />
      {query.isPending ? (
        <SkeletonList count={4} height={76} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : query.data.results.length === 0 ? (
        <EmptyState icon="💬" title={t("chat.empty")} text={t("chat.emptyText")} />
      ) : (
        query.data.results.map((conversation) => {
          const other = conversation.other_participant;
          const name = other?.display_name ?? t("common.anonymous");
          const last = conversation.last_message;
          const preview = last ? (last.message_type === "IMAGE" ? t("chat.image") : last.text) : "";
          return (
            <Card key={conversation.id} to={`/chats/${conversation.id}`}>
              <div className={styles.person}>
                <Avatar name={name} media={other?.avatar} size={48} />
                <div className={styles.personInfo}>
                  <div className="row-between">
                    <span className={styles.personName}>{name}</span>
                    {conversation.last_message_at && (
                      <span className="muted" style={{ fontSize: 12 }}>
                        {timeAgo(conversation.last_message_at)}
                      </span>
                    )}
                  </div>
                  <div className={styles.personStats}>
                    {CATEGORY_EMOJI[conversation.help_request.category]} {conversation.help_request.title}
                  </div>
                  <div className="row-between">
                    <span
                      className="muted"
                      style={{
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {preview}
                    </span>
                    {conversation.unread_count > 0 && <Badge tone="count">{conversation.unread_count}</Badge>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })
      )}
    </main>
  );
}
