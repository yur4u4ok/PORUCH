import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useParams } from "react-router";

import { helpRequestsApi } from "@/api/helpRequests";
import { BRAND } from "@/app/brand";
import { BrandMark } from "@/components/layout/BrandMark";
import { Button, Card, EmptyState, Loader } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { UrgencyBadge } from "@/features/help/components";
import { LanguageSwitcher } from "@/features/profile/LanguageSwitcher";
import { rememberAfterAuth } from "@/utils/afterAuth";
import { requestEmoji } from "@/utils/categories";
import { timeAgo } from "@/utils/format";
import { rewardSummary } from "@/utils/reward";
import { emergencyVars } from "@/utils/emergency";

import styles from "../Landing/Landing.module.css";

/** Public landing for a shared request link: works without an account. */
export default function SharePage() {
  const { code = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me, isPending: mePending } = useMe();
  const preview = useQuery({
    queryKey: ["share", code],
    queryFn: () => helpRequestsApi.sharePreview(code),
    retry: false,
    meta: { silent: true },
  });

  const target = preview.data ? `/help/${preview.data.id}` : null;
  useEffect(() => {
    if (target) rememberAfterAuth(target);
  }, [target]);

  if (mePending || preview.isPending) return <Loader />;
  if (me && target) return <Navigate to={target} replace />;

  const data = preview.data;
  return (
    <main className={styles.authPage}>
      <div className="row-between">
        <Link to="/" aria-label={BRAND} style={{ textDecoration: "none" }}>
          <BrandMark />
        </Link>
        <LanguageSwitcher compact />
      </div>

      {!data ? (
        <EmptyState icon="🔗" title={t("share.notFound")} action={<Link to="/">{BRAND}</Link>} />
      ) : !data.active ? (
        <EmptyState
          icon="✓"
          title={t("share.inactive")}
          text={t("share.inactiveText")}
          action={<Button onClick={() => navigate("/auth/register")}>{t("landing.join")}</Button>}
        />
      ) : (
        <>
          <p className="muted">{t("share.publicTitle")}</p>
          <Card className="stack-sm">
            <div className="row" style={{ alignItems: "flex-start" }}>
              <span style={{ fontSize: 36 }} aria-hidden>
                {data.category ? requestEmoji(data.category, data.subcategory) : "🆘"}
              </span>
              <div className="stack-sm">
                <h1 style={{ fontSize: "var(--text-xl)" }}>{data.title}</h1>
                <div className="row wrap muted" style={{ fontSize: 14 }}>
                  {data.urgency && <UrgencyBadge urgency={data.urgency} />}
                  {data.place && <span>📍 {data.place}</span>}
                  <span>{timeAgo(data.created_at)}</span>
                </div>
              </div>
            </div>
            <p style={{ whiteSpace: "pre-wrap" }}>{data.description}</p>
            {data.reward_type && data.reward_type !== "NONE" && (
              <p>
                <strong>{t("request.rewardInfo")}:</strong>{" "}
                {rewardSummary(
                  {
                    reward_type: data.reward_type,
                    reward_amount: data.reward_amount,
                    reward_currency: data.reward_currency,
                    reward_options: data.reward_options,
                  },
                  t,
                )}
              </p>
            )}
          </Card>
          <p className="muted">{t("share.whatIsPoruch")}</p>
          <Button size="lg" variant="help" block onClick={() => navigate("/auth/register")}>
            🤝 {t("share.canHelp")}
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => navigate("/auth/login", { state: { from: target } })}
          >
            {t("share.login")}
          </Button>
          <p className="muted" style={{ fontSize: 13 }}>
            ⚠️ {t("emergency.short", emergencyVars())}
          </p>
        </>
      )}
    </main>
  );
}
