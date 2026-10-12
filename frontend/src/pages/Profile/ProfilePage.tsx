import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ZoomableAvatar } from "@/features/profile/ZoomableAvatar";

import { FeedbackCards } from "@/features/reviews/Feedback";
import { useFeedback } from "@/features/reviews/useFeedback";
import { RatingSummary } from "@/features/reviews/Reviews";
import { Link } from "react-router";

import { mediaApi } from "@/api/media";
import { PageHeader } from "@/components/layout/AppLayout";
import { SettingsIcon } from "@/components/layout/NavIcons";
import { helpRequestsApi, type HistoryQuery } from "@/api/helpRequests";
import { queryKeys } from "@/api/queryKeys";
import {
  Button,
  EmptyState,
  ErrorState,
  InfoTip,
  ListTools,
  Loader,
  PagedBlock,
  SkeletonList,
  Switcher,
} from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { useLogoutConfirm } from "@/features/auth/LogoutConfirm";
import { ContactsCard } from "@/features/profile/ContactsCard";
import { HelpRequestCard } from "@/features/help/components";
import { useUpdateMe } from "@/features/profile/hooks";
import { HISTORY_SORTS, useListFilter } from "@/hooks/useListFilter";
import { PAGE_SIZE, usePagedList } from "@/hooks/usePagedList";
import { toast } from "@/stores/toastStore";

import styles from "./Profile.module.css";

type HistoryTab = "author" | "helper" | "applied" | "reviews" | "thanks";

/** «Моя допомога»: own requests, help given, offers made, plus reviews and thanks — one switch. */
function History({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<HistoryTab>("author");
  const filter = useListFilter("newest");
  const query = (role: HistoryQuery["role"]): HistoryQuery => ({
    role,
    q: filter.q || undefined,
    sort: filter.sort,
  });
  const fetchQuery = (q: HistoryQuery) => (page: number, signal: AbortSignal) =>
    helpRequestsApi.history({ ...q, page, page_size: PAGE_SIZE }, signal);
  const paged = (role: HistoryQuery["role"]) =>
    [queryKeys.history(query(role)), fetchQuery(query(role))] as const;
  const author = usePagedList(...paged("author"));
  const helper = usePagedList(...paged("helper"));
  const applied = usePagedList(...paged("applied"));
  const feedback = useFeedback(userId);
  const lists = { author, helper, applied, ...feedback };
  const list = lists[tab];
  const isFeedback = tab === "reviews" || tab === "thanks";
  const emptyText = {
    author: "profile.noHistory",
    helper: "profile.noHistory",
    applied: "profile.noDeclined",
    reviews: "reviews.none",
    thanks: "profile.noThanks",
  }[tab];
  return (
    <section className="stack-sm">
      <Switcher
        label={t("profile.history")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "author", label: t("profile.asked"), count: lists.author.count },
          { value: "helper", label: t("profile.helpedTab"), count: lists.helper.count },
          { value: "applied", label: t("profile.declinedTab"), count: lists.applied.count },
          { value: "reviews", label: t("reviews.heading"), count: lists.reviews.count },
          { value: "thanks", label: t("profile.receivedThanks"), count: lists.thanks.count },
        ]}
      >
        {!isFeedback && <ListTools filter={filter} sorts={HISTORY_SORTS} />}
        {list.isPending ? (
          <SkeletonList count={2} />
        ) : list.isError ? (
          <ErrorState onRetry={() => void list.refetch()} />
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={isFeedback ? "💬" : "📜"}
            title={t(filter.active && !isFeedback ? "listTools.nothingFound" : emptyText)}
          />
        ) : (
          <PagedBlock
            key={tab}
            page={list.page}
            pages={list.pages}
            onPage={list.setPage}
            busy={list.isFetching}
          >
            {tab === "reviews" || tab === "thanks" ? (
              <FeedbackCards tab={tab} feedback={feedback} />
            ) : (
              lists[tab].items.map((r) => <HelpRequestCard key={r.id} request={r} showStatus />)
            )}
          </PagedBlock>
        )}
      </Switcher>
    </section>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { data: me, isPending } = useMe();
  const updateMe = useUpdateMe();
  const logout = useLogoutConfirm();
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  if (isPending || !me) return <Loader />;

  /** Inline rename: Enter or leaving the field saves, Esc cancels; empty or unchanged does nothing. */
  const saveName = () => {
    const next = name.trim();
    setEditName(false);
    if (next && next !== me.display_name) updateMe.mutate({ display_name: next });
  };

  const onAvatar = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const media = await mediaApi.upload(file, "AVATAR");
      await updateMe.mutateAsync({ avatar_id: media.id });
    } catch {
      toast.error(t("create.photoUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="page stack">
      <PageHeader
        title={t("profile.title")}
        actions={
          <Link to="/settings" className={styles.settingsLink}>
            <SettingsIcon />
            {t("settings.title")}
          </Link>
        }
      />
      <div className={styles.head}>
        <div className={styles.avatarBox}>
          <ZoomableAvatar name={me.display_name} media={me.avatar} size={96} />
          <label
            className={`${styles.avatarAction} ${styles.avatarChange}`}
            title={t("profile.changeAvatar")}
            aria-busy={uploading}
          >
            <span aria-hidden>{uploading ? "⏳" : "✏️"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="visually-hidden"
              aria-label={t("profile.changeAvatar")}
              onChange={(e) => void onAvatar(e.target.files?.[0])}
            />
          </label>
          {me.avatar && (
            <button
              type="button"
              className={`${styles.avatarAction} ${styles.avatarRemove}`}
              title={t("profile.removeAvatar")}
              aria-label={t("profile.removeAvatar")}
              onClick={() => updateMe.mutate({ avatar_id: null })}
            >
              <span aria-hidden>🗑️</span>
            </button>
          )}
        </div>
        <div className={styles.nameRow}>
          {editName ? (
            <input
              className={styles.nameInput}
              aria-label={t("auth.displayName")}
              value={name}
              maxLength={50}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditName(false);
              }}
              onBlur={saveName}
            />
          ) : (
            <button
              type="button"
              className={styles.name}
              title={t("profile.renameHint")}
              onClick={() => (setName(me.display_name), setEditName(true))}
            >
              <h1>{me.display_name}</h1>
            </button>
          )}
          <InfoTip
            label={t(me.email_verified ? "profile.verified" : "profile.emailNotVerified")}
            text={
              <>
                {t(me.email_verified ? "profile.verified" : "profile.emailNotVerified")}
                <br />
                {t("common.since", { year: new Date(me.date_joined).getFullYear() })}
              </>
            }
            className={me.email_verified ? styles.verified : styles.unverified}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <circle cx="12" cy="12" r="11" fill="currentColor" />
                <path
                  d="M7 12.5l3.2 3.2L17 9"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
          />
        </div>
        <div className={styles.stats}>
          <span>{t("profile.helped", { count: me.helped_count })}</span>
          <span>{t("profile.thanks", { count: me.thanks_received_count })}</span>
          <RatingSummary user={me} />
        </div>
      </div>

      <ContactsCard me={me} />

      <History userId={me.id} />

      <div className="stack-sm">
        <Button variant="danger" block onClick={logout.ask}>
          {t("auth.logout")}
        </Button>
        {logout.dialog}
      </div>
    </main>
  );
}
