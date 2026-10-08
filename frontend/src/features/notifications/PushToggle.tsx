import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui";
import { toast } from "@/stores/toastStore";

import {
  disablePushOnThisDevice,
  enablePush,
  hasActivePushSubscription,
  notificationPermission,
  pushSupport,
} from "./push";

/** hideWhenActive: where a separate on/off switch already exists (settings), show only the «enable» step. */
export function PushToggle({
  compact = false,
  hideWhenActive = false,
}: {
  compact?: boolean;
  hideWhenActive?: boolean;
}) {
  const { t } = useTranslation();
  const support = pushSupport();
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const permission = notificationPermission();

  useEffect(() => {
    void hasActivePushSubscription()
      .then(setActive)
      .catch(() => setActive(false));
  }, []);

  if (support === "unsupported") return <p className="muted">{t("notifications.unsupported")}</p>;
  if (support === "ios-needs-install") return <p className="muted">{t("notifications.iosHint")}</p>;
  if (permission === "denied") return <p className="muted">{t("notifications.denied")}</p>;

  const onEnable = async () => {
    setBusy(true);
    try {
      const ok = await enablePush();
      setActive(ok);
      if (ok) toast.success(t("notifications.enabled"));
      else if (notificationPermission() === "denied") toast.error(t("notifications.denied"));
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async () => {
    setBusy(true);
    try {
      await disablePushOnThisDevice();
      setActive(false);
    } finally {
      setBusy(false);
    }
  };

  if (active) {
    if (hideWhenActive) return null;
    return compact ? (
      <span className="muted">✓ {t("notifications.enabled")}</span>
    ) : (
      <div className="row-between">
        <span>✓ {t("notifications.enabled")}</span>
        <Button variant="ghost" size="sm" onClick={onDisable} loading={busy}>
          {t("notifications.disable")}
        </Button>
      </div>
    );
  }
  return (
    <Button variant="help" onClick={onEnable} loading={busy} block={!compact}>
      🔔 {t("notifications.enable")}
    </Button>
  );
}
