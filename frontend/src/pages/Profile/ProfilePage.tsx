import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { mediaApi } from "@/api/media";
import { PageHeader } from "@/components/layout/AppLayout";
import { allResults } from "@/api/paging";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Loader,
  LoadMore,
  SkeletonList,
  Tabs,
} from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { useLogoutConfirm } from "@/features/auth/LogoutConfirm";
import { ContactsCard } from "@/features/profile/ContactsCard";
import { HelpRequestCard } from "@/features/help/components";
import { useHelpHistory } from "@/features/help/hooks";
import { useThanks, useUpdateMe } from "@/features/profile/hooks";
import { toast } from "@/stores/toastStore";
import { timeAgo } from "@/utils/format";

import styles from "./Profile.module.css";

function History() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"author" | "helper">("author");
  const history = useHelpHistory({ role: tab });
  const items = history.data?.pages.flatMap((p) => p.results) ?? [];
  return (
    <section className="stack-sm">
      <h2>{t("profile.history")}</h2>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "author", label: t("profile.asked") },
          { value: "helper", label: t("profile.helpedTab") },
        ]}
      />
      {history.isPending ? (
        <SkeletonList count={2} />
      ) : history.isError ? (
        <ErrorState onRetry={() => void history.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="📜" title={t("profile.noHistory")} />
      ) : (
        <>
          {items.map((r) => (
            <HelpRequestCard key={r.id} request={r} showStatus />
          ))}
          <LoadMore
            hasNextPage={history.hasNextPage}
            isFetching={history.isFetchingNextPage}
            onLoad={() => void history.fetchNextPage()}
          />
        </>
      )}
    </section>
  );
}

export function ThanksList({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const thanks = useThanks(userId);
  const items = allResults(thanks.data);
  return (
    <section className="stack-sm">
      <h2>{t("profile.receivedThanks")}</h2>
      {thanks.isPending ? (
        <SkeletonList count={1} height={64} />
      ) : items.length === 0 ? (
        <p className="muted">{t("profile.noThanks")}</p>
      ) : (
        items.map((thank) => (
          <Card key={thank.id} className="stack-sm">
            <p>❤️ {thank.message || t("thanks.placeholder")}</p>
            <span className="muted" style={{ fontSize: 13 }}>
              {thank.from_user.display_name ?? t("common.anonymous")} · {thank.help_request.title} ·{" "}
              {timeAgo(thank.created_at)}
            </span>
          </Card>
        ))
      )}
      <LoadMore
        hasNextPage={thanks.hasNextPage}
        isFetching={thanks.isFetchingNextPage}
        onLoad={() => void thanks.fetchNextPage()}
      />
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
            <span aria-hidden>⚙️</span>
            {t("settings.title")}
          </Link>
        }
      />
      <div className={styles.head}>
        <Avatar name={me.display_name} media={me.avatar} size={96} />
        <div className="row">
          <label className={styles.avatarEdit}>
            {uploading ? t("create.uploading") : t("profile.changeAvatar")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="visually-hidden"
              onChange={(e) => void onAvatar(e.target.files?.[0])}
            />
          </label>
          {me.avatar && (
            <button
              type="button"
              className={styles.avatarEdit}
              onClick={() => updateMe.mutate({ avatar_id: null })}
            >
              {t("profile.removeAvatar")}
            </button>
          )}
        </div>
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
            <span aria-hidden>✏️</span>
          </button>
        )}
        <div className={styles.stats}>
          <span>{t("profile.helped", { count: me.helped_count })}</span>
          <span>{t("profile.thanks", { count: me.thanks_received_count })}</span>
        </div>
        <span className="muted">
          {t("common.since", { year: new Date(me.date_joined).getFullYear() })} ·{" "}
          {me.email_verified ? `✓ ${t("profile.verified")}` : t("profile.notVerified")}
        </span>
      </div>

      <ContactsCard me={me} />

      <History />
      <ThanksList userId={me.id} />

      <div className="stack-sm">
        <Button variant="danger" block onClick={logout.ask}>
          {t("auth.logout")}
        </Button>
        {logout.dialog}
      </div>
    </main>
  );
}
