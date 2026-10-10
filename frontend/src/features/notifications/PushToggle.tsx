import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui";

import { notificationPermission, pushSupport } from "./push";
import styles from "./PushToggle.module.css";
import { useEnablePush, usePushOn } from "./usePush";

/** Why push can't be turned on here, or null. */
export function PushUnavailable() {
  const { t } = useTranslation();
  const support = pushSupport();
  if (support === "unsupported") return <p className="muted">{t("notifications.unsupported")}</p>;
  if (support === "ios-needs-install") return <p className="muted">{t("notifications.iosHint")}</p>;
  if (notificationPermission() === "denied") return <p className="muted">{t("notifications.denied")}</p>;
  return null;
}

/**
 * «Turn on notifications» prompt. Shows nothing once push is on — except in onboarding
 * (`confirmWhenOn`), where a calm «enabled» line confirms the step.
 */
export function PushToggle({
  compact = false,
  confirmWhenOn = false,
}: {
  compact?: boolean;
  confirmWhenOn?: boolean;
}) {
  const { t } = useTranslation();
  const on = usePushOn();
  const enable = useEnablePush();
  const unavailable = <PushUnavailable />;

  if (on === null) return null;
  if (on) {
    if (!confirmWhenOn) return null;
    return (
      <div className={styles.on} role="status">
        <span className={styles.onIcon} aria-hidden>
          ✓
        </span>
        <span>
          <strong>{t("notifications.enabled")}</strong>
          <span className={styles.onHint}>{t("notifications.enabledHint")}</span>
        </span>
      </div>
    );
  }
  if (pushSupport() !== "supported" || notificationPermission() === "denied") return unavailable;
  return (
    <Button variant="help" onClick={() => void enable.run()} loading={enable.busy} block={!compact}>
      🔔 {t("notifications.enable")}
    </Button>
  );
}
