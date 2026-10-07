import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { PageHeader } from "@/components/layout/AppLayout";
import { allResults } from "@/api/paging";
import { Button, Card, EmptyState, ErrorState, LoadMore, SkeletonList } from "@/components/ui";
import { useMarkAllRead, useMarkNotificationRead, useNotifications } from "@/features/notifications/hooks";
import { PushToggle } from "@/features/notifications/PushToggle";
import type { AppNotification } from "@/types/api";
import { timeAgo } from "@/utils/format";

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const query = useNotifications();
  const items = allResults(query.data);
  const unreadCount = query.data?.pages[0]?.unread_count ?? 0;
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();

  const open = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate({ id: n.id });
    if (n.url) navigate(n.url);
  };

  return (
    <main className="page stack">
      <PageHeader
        title={t("notifications.title")}
        actions={
          unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => markAll.mutate()}>
              {t("notifications.readAll")}
            </Button>
          )
        }
      />
      <PushToggle hideWhenActive />
      {query.isPending ? (
        <SkeletonList count={4} height={72} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="🔔" title={t("notifications.empty")} />
      ) : (
        items.map((n) => (
          <Card
            key={n.id}
            role="button"
            tabIndex={0}
            style={{
              cursor: "pointer",
              opacity: n.is_read ? 0.7 : 1,
              borderColor: n.is_read ? undefined : "var(--color-primary)",
            }}
            onClick={() => open(n)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && open(n)}
          >
            <div className="stack-sm">
              <strong>{n.title}</strong>
              {n.body && <span style={{ whiteSpace: "pre-line" }}>{n.body}</span>}
              <span className="muted" style={{ fontSize: 12 }}>
                {timeAgo(n.created_at)}
              </span>
            </div>
          </Card>
        ))
      )}
      <LoadMore
        hasNextPage={query.hasNextPage}
        isFetching={query.isFetchingNextPage}
        onLoad={() => void query.fetchNextPage()}
      />
    </main>
  );
}
