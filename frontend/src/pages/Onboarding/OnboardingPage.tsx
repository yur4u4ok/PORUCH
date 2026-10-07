import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";

import { Button, Card } from "@/components/ui";
import { SelectAll } from "@/features/help/SelectAll";
import { CategoryChips } from "@/features/help/components";
import { useGeolocation } from "@/features/location/useGeolocation";
import { PushToggle } from "@/features/notifications/PushToggle";
import { usePublicConfig, useUpdateMe, useUpdatePreferences } from "@/features/profile/hooks";
import type { NotificationCategory } from "@/types/api";
import { consumeAfterAuth } from "@/utils/afterAuth";

import styles from "../Landing/Landing.module.css";

const TOTAL = 3;
const DEFAULT: NotificationCategory[] = ["AUTO", "HOME", "ITEMS", "ANIMALS", "PEOPLE"];

export default function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<NotificationCategory[]>(DEFAULT);
  const { position, status, locate } = useGeolocation();
  const { data: config } = usePublicConfig();
  const updatePrefs = useUpdatePreferences();
  const updateMe = useUpdateMe();

  const allowLocation = async () => {
    const pos = await locate({ force: true });
    if (pos) updatePrefs.mutate({ location: pos });
  };

  const finish = async () => {
    await updatePrefs.mutateAsync({ enabled_categories: categories }).catch(() => undefined);
    await updateMe.mutateAsync({ onboarding_completed: true });
    navigate(consumeAfterAuth(from), { replace: true });
  };

  const offered = (config?.notification_categories ?? DEFAULT).filter(
    (c) => c !== "URGENT" && c !== "DISTRICT",
  );
  const toggle = (c: NotificationCategory) =>
    setCategories((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));

  return (
    <main className={styles.authPage}>
      <p className="muted">{t("onboarding.step", { current: step, total: TOTAL })}</p>
      {step === 1 && (
        <Card className="stack">
          <h2>📍 {t("onboarding.locationTitle")}</h2>
          <p className="muted">{t("onboarding.locationText")}</p>
          {position ? (
            <p>{t("onboarding.locationGranted")}</p>
          ) : (
            <Button variant="help" onClick={allowLocation} loading={status === "locating"} block>
              {t("onboarding.locationAllow")}
            </Button>
          )}
          {status === "denied" && <p className="muted">{t("settings.locationDenied")}</p>}
          <p className="muted" style={{ fontSize: 13 }}>
            ℹ️ {t("onboarding.changeLater")}
          </p>
        </Card>
      )}
      {step === 2 && (
        <Card className="stack">
          <h2>🔔 {t("onboarding.notificationsTitle")}</h2>
          <p className="muted">{t("onboarding.notificationsText")}</p>
          <PushToggle />
          <p className="muted" style={{ fontSize: 13 }}>
            ℹ️ {t("onboarding.changeLater")}
          </p>
        </Card>
      )}
      {step === 3 && (
        <Card className="stack">
          <h2>🤝 {t("onboarding.categoriesTitle")}</h2>
          <p className="muted">{t("onboarding.categoriesText")}</p>
          <SelectAll all={offered} selected={categories} onChange={setCategories} />
          <CategoryChips
            options={offered}
            selected={categories}
            onToggle={toggle}
            labelKey="notificationCategories"
          />
        </Card>
      )}
      <div className="row-between">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)}>
            ← {t("common.back")}
          </Button>
        ) : (
          <span />
        )}
        <div className="row">
          {step < TOTAL ? (
            <>
              <Button variant="ghost" onClick={() => setStep(step + 1)}>
                {t("common.skip")}
              </Button>
              <Button onClick={() => setStep(step + 1)}>{t("common.next")}</Button>
            </>
          ) : (
            <Button onClick={finish} loading={updateMe.isPending}>
              {t("common.done")}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
