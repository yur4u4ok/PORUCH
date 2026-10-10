import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { usePreferences, useUpdatePreferences } from "@/features/profile/hooks";
import { toast } from "@/stores/toastStore";

import { enablePush, hasActivePushSubscription, notificationPermission, usePushDevice } from "./push";

/**
 * Push is «on» only when both are true: this device is subscribed AND the account setting
 * (Settings → Push) is on. Every screen uses this, so they never disagree.
 */
export function usePushOn(): boolean | null {
  const active = usePushDevice((s) => s.active);
  const { data: prefs } = usePreferences();
  useEffect(() => {
    if (active === null) void hasActivePushSubscription().catch(() => undefined);
  }, [active]);
  if (active === null || !prefs) return null;
  return active && prefs.push_enabled;
}

/** Turn push on: browser permission + device subscription + the account setting. */
export function useEnablePush() {
  const { t } = useTranslation();
  const { data: prefs } = usePreferences();
  const update = useUpdatePreferences();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const ok = await enablePush();
      if (ok && prefs && !prefs.push_enabled) await update.mutateAsync({ push_enabled: true });
      if (ok) toast.success(t("notifications.enabled"));
      else if (notificationPermission() === "denied") toast.error(t("notifications.denied"));
      return ok;
    } catch {
      toast.error(t("common.error"));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { run, busy };
}
