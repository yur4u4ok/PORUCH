import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "@/components/layout/AppLayout";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  LoadMore,
  SearchField,
  SkeletonList,
} from "@/components/ui";
import { allResults } from "@/api/paging";
import { useAllConversations } from "@/features/chat/hooks";
import { CATEGORY_EMOJI } from "@/utils/categories";
import { timeAgo } from "@/utils/format";

import styles from "../HelpRequest/HelpRequest.module.css";

export default function ConversationsPage() {
  const { t } = useTranslation();
  const query = useAllConversations();
  const [search, setSearch] = useState("");
  const all = allResults(query.data);
  const needle = search.trim().toLocaleLowerCase();
  // Every chat is already loaded, so search right here: the person, the request and the last message.
  const conversations = needle
    ? all.filter((c) =>
        [c.other_participant?.display_name, c.help_request.title, c.last_message?.text]
          .filter(Boolean)
          .some((text) => text!.toLocaleLowerCase().includes(needle)),
      )
    : all;
  return (
    <main className="page stack">
      <PageHeader title={t("chat.title")} />
      {all.length > 0 && <SearchField value={search} onChange={setSearch} />}
      {query.isPending ? (
        <SkeletonList count={4} height={76} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : all.length > 0 && conversations.length === 0 ? (
        <EmptyState icon="🔍" title={t("listTools.nothingFound")} />
      ) : conversations.length === 0 ? (
        <EmptyState icon="💬" title={t("chat.empty")} text={t("chat.emptyText")} />
      ) : (
        conversations.map((conversation) => {
          const other = conversation.other_participant;
          const name = other?.display_name ?? t("common.anonymous");
          const last = conversation.last_message;
          const preview = last ? (last.message_type === "IMAGE" ? t("chat.image") : last.text) : "";
          return (
            <Card key={conversation.id} to={`/chats/${conversation.id}`}>
              <div className={styles.person}>
                <Avatar name={name} media={other?.avatar} size={48} online={conversation.other_online} />
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
      <LoadMore
        hasNextPage={query.hasNextPage}
        isFetching={query.isFetchingNextPage}
        onLoad={() => void query.fetchNextPage()}
      />
    </main>
  );
}
