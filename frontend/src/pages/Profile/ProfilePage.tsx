import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { mediaApi } from "@/api/media";
import { PageHeader } from "@/components/layout/AppLayout";
import {
  Avatar,
  BottomSheet,
  Button,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Loader,
  SkeletonList,
  Tabs,
} from "@/components/ui";
import { useLogout, useMe } from "@/features/auth/hooks";
import { HelpRequestCard } from "@/features/help/components";
import { useHelpHistory } from "@/features/help/hooks";
import { CapabilityList } from "@/features/profile/CapabilityList";
import {
  useCapabilities,
  useMyCapabilities,
  useSetMyCapabilities,
  useThanks,
  useUpdateMe,
} from "@/features/profile/hooks";
import { toast } from "@/stores/toastStore";
import { timeAgo } from "@/utils/format";

import styles from "./Profile.module.css";

function CapabilitiesEditor({
  open,
  onClose,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  initial: string[];
}) {
  const { t } = useTranslation();
  const { data: all } = useCapabilities();
  const save = useSetMyCapabilities();
  const [selected, setSelected] = useState<string[]>(initial);
  const toggle = (code: string) =>
    setSelected((s) => (s.includes(code) ? s.filter((c) => c !== code) : [...s, code]));
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("profile.editCapabilities")}
      actions={
        <Button block loading={save.isPending} onClick={() => save.mutate(selected, { onSuccess: onClose })}>
          {t("common.save")}
        </Button>
      }
    >
      {(["HELP", "ITEM"] as const).map((kind) => (
        <div key={kind} className="stack-sm">
          <strong>{kind === "HELP" ? t("profile.canHelp") : t("profile.has")}</strong>
          <div className="row wrap">
            {all
              ?.filter((c) => c.kind === kind)
              .map((c) => (
                <Chip key={c.code} active={selected.includes(c.code)} onClick={() => toggle(c.code)}>
                  {c.emoji} {t(`capabilities.${c.code}`)}
                </Chip>
              ))}
          </div>
        </div>
      ))}
    </BottomSheet>
  );
}

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
          {history.hasNextPage && (
            <Button variant="secondary" onClick={() => void history.fetchNextPage()}>
              {t("nearby.loadMore")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

export function ThanksList({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const thanks = useThanks(userId);
  const items = thanks.data?.results ?? [];
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
    </section>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me, isPending } = useMe();
  const caps = useMyCapabilities();
  const updateMe = useUpdateMe();
  const logout = useLogout();
  const [editCaps, setEditCaps] = useState(false);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  if (isPending || !me) return <Loader />;

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
        back={false}
        actions={
          <Link to="/settings">
            <Button variant="ghost" size="sm" aria-label={t("settings.title")}>
              ⚙️
            </Button>
          </Link>
        }
      />
      <div className={styles.head}>
        <Avatar name={me.display_name} media={me.avatar} size={96} />
        <label className={styles.avatarEdit}>
          {uploading ? t("create.uploading") : t("profile.changeAvatar")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="visually-hidden"
            onChange={(e) => void onAvatar(e.target.files?.[0])}
          />
        </label>
        <h1>{me.display_name}</h1>
        <Button variant="ghost" size="sm" onClick={() => (setName(me.display_name), setEditName(true))}>
          ✏️ {t("profile.edit")}
        </Button>
        <div className={styles.stats}>
          <span>{t("profile.helped", { count: me.helped_count })}</span>
          <span>{t("profile.thanks", { count: me.thanks_received_count })}</span>
        </div>
        <span className="muted">
          {t("common.since", { year: new Date(me.date_joined).getFullYear() })} ·{" "}
          {me.email_verified ? `✓ ${t("profile.verified")}` : t("profile.notVerified")}
        </span>
      </div>

      <Card className="stack-sm">
        {caps.data && caps.data.length > 0 ? (
          <CapabilityList capabilities={caps.data} />
        ) : (
          <p className="muted">{t("onboarding.categoriesTitle")}</p>
        )}
        <Button variant="secondary" size="sm" onClick={() => setEditCaps(true)}>
          {t("profile.editCapabilities")}
        </Button>
      </Card>

      <History />
      <ThanksList userId={me.id} />

      <div className="stack-sm">
        <Link to="/notifications">
          <Button variant="secondary" block>
            🔔 {t("nav.notifications")}
          </Button>
        </Link>
        <Button
          variant="danger"
          block
          onClick={() => logout.mutate(undefined, { onSettled: () => navigate("/", { replace: true }) })}
        >
          {t("auth.logout")}
        </Button>
      </div>

      {editCaps && (
        <CapabilitiesEditor
          open={editCaps}
          onClose={() => setEditCaps(false)}
          initial={caps.data?.map((c) => c.code) ?? []}
        />
      )}
      <BottomSheet
        open={editName}
        onClose={() => setEditName(false)}
        title={t("profile.edit")}
        actions={
          <Button
            block
            loading={updateMe.isPending}
            onClick={() => updateMe.mutate({ display_name: name }, { onSuccess: () => setEditName(false) })}
          >
            {t("common.save")}
          </Button>
        }
      >
        <Input
          label={t("auth.displayName")}
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
        />
        {me.avatar && (
          <Button variant="ghost" onClick={() => updateMe.mutate({ avatar_id: null })}>
            {t("profile.removeAvatar")}
          </Button>
        )}
      </BottomSheet>
    </main>
  );
}
