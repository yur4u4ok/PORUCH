import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useNavigate, useParams } from "react-router";

import { PageHeader } from "@/components/layout/AppLayout";
import { Avatar, Button, Card, EmptyState, Loader } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { ConfirmDialog, ReportDialog } from "@/features/help/components";
import { CapabilityList } from "@/features/profile/CapabilityList";
import { useBlockUser, usePublicProfile } from "@/features/profile/hooks";
import { toast } from "@/stores/toastStore";

import styles from "./Profile.module.css";
import { ThanksList } from "./ProfilePage";

export default function PublicProfilePage() {
  const { id = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const profile = usePublicProfile(id);
  const block = useBlockUser();
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  if (me?.id === id) return <Navigate to="/profile" replace />;
  if (profile.isPending) return <Loader />;
  if (profile.isError) {
    return (
      <main className="page">
        <PageHeader title="" />
        <EmptyState icon="🙈" title={t("profile.notFound")} />
      </main>
    );
  }
  const user = profile.data;
  const name = user.display_name ?? t("common.anonymous");
  return (
    <main className="page stack">
      <PageHeader title={name} />
      <div className={styles.head}>
        <Avatar name={name} media={user.avatar} size={96} />
        <h1>{name}</h1>
        <div className={styles.stats}>
          <span>{t("profile.helped", { count: user.helped_count })}</span>
          <span>{t("profile.thanks", { count: user.thanks_received_count })}</span>
        </div>
        <span className="muted">
          {t("common.since", { year: new Date(user.member_since).getFullYear() })}
          {user.is_verified && ` · ✓ ${t("profile.verified")}`}
        </span>
      </div>
      {(user.capabilities.length > 0 || user.custom_items.length > 0) && (
        <Card>
          <CapabilityList capabilities={user.capabilities} customItems={user.custom_items} />
        </Card>
      )}
      <ThanksList userId={user.id} />
      <div className="row" style={{ justifyContent: "center" }}>
        <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)}>
          🚩 {t("request.report")}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setBlockOpen(true)}>
          ⛔ {t("request.block")}
        </Button>
      </div>
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        target={{ target_user_id: user.id }}
      />
      <ConfirmDialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title={t("request.block")}
        text={t("request.blockConfirm")}
        confirmLabel={t("request.block")}
        danger
        loading={block.isPending}
        onConfirm={() =>
          block.mutate(user.id, {
            onSuccess: () => {
              toast.success(t("request.blocked"));
              navigate(-1);
            },
          })
        }
      />
    </main>
  );
}
