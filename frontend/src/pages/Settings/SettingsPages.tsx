import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { PageHeader } from "@/components/layout/AppLayout";
import { Avatar, Button, Card, EmptyState, Loader, Switch } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { CategoryChips, ConfirmDialog, RadiusChips } from "@/features/help/components";
import { geolocationPermission, useGeolocation } from "@/features/location/useGeolocation";
import { PushToggle } from "@/features/notifications/PushToggle";
import {
  useBlocks,
  useDeactivate,
  usePreferences,
  usePublicConfig,
  useUnblockUser,
  useUpdateMe,
  useUpdatePreferences,
} from "@/features/profile/hooks";
import { ThemeSwitcher } from "@/features/profile/ThemeSwitcher";
import { toast } from "@/stores/toastStore";
import type { NotificationCategory } from "@/types/api";

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <main className="page stack">
      <PageHeader title={t("settings.title")} />
      <Card className="stack-sm">
        <strong>{t("settings.theme")}</strong>
        <ThemeSwitcher />
      </Card>
      <Card to="/settings/notifications">🔔 {t("settings.notifications")}</Card>
      <Card to="/settings/privacy">🔒 {t("settings.privacy")}</Card>
      <p className="muted" style={{ fontSize: 13 }}>
        ⚠️ {t("settings.about")}
      </p>
    </main>
  );
}

export function NotificationSettingsPage() {
  const { t } = useTranslation();
  const { data: prefs, isPending } = usePreferences();
  const { data: config } = usePublicConfig();
  const update = useUpdatePreferences();
  const { locate, status } = useGeolocation();

  if (isPending || !prefs) return <Loader />;

  const toggleCategory = (c: NotificationCategory) => {
    const next = prefs.enabled_categories.includes(c)
      ? prefs.enabled_categories.filter((x) => x !== c)
      : [...prefs.enabled_categories, c];
    update.mutate({ enabled_categories: next });
  };

  const updateLocation = async () => {
    const position = await locate({ force: true });
    if (position)
      update.mutate(
        { location: position },
        { onSuccess: () => toast.success(t("settings.locationUpdated")) },
      );
  };

  return (
    <main className="page stack">
      <PageHeader title={t("settings.notifications")} />
      <Card className="stack-sm">
        <strong>{t("settings.push")}</strong>
        <PushToggle />
        <Switch
          label={t("settings.push")}
          checked={prefs.push_enabled}
          onChange={(v) => update.mutate({ push_enabled: v })}
        />
        <Switch
          label={t("settings.email")}
          checked={prefs.email_enabled}
          onChange={(v) => update.mutate({ email_enabled: v })}
        />
      </Card>
      <Card className="stack-sm">
        <strong>{t("settings.radius")}</strong>
        <RadiusChips
          radii={config?.radii ?? [500, 1000, 3000, 5000, 10000]}
          value={prefs.notification_radius}
          onChange={(r) => update.mutate({ notification_radius: r })}
        />
      </Card>
      <Card className="stack-sm">
        <strong>{t("settings.categories")}</strong>
        <CategoryChips
          options={config?.notification_categories ?? []}
          selected={prefs.enabled_categories}
          onToggle={toggleCategory}
          labelKey="notificationCategories"
        />
      </Card>
      <Card className="stack-sm">
        <Button variant="secondary" onClick={updateLocation} loading={status === "locating"}>
          📍 {t("settings.updateLocation")}
        </Button>
      </Card>
    </main>
  );
}

export function PrivacySettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const updateMe = useUpdateMe();
  const blocks = useBlocks();
  const unblock = useUnblockUser();
  const deactivate = useDeactivate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [geoState, setGeoState] = useState<string>("prompt");

  useEffect(() => {
    void geolocationPermission().then(setGeoState);
  }, []);

  if (!me) return <Loader />;
  const geoLabel =
    geoState === "granted"
      ? t("settings.locationGranted")
      : geoState === "denied"
        ? t("settings.locationDenied")
        : t("settings.locationPrompt");

  return (
    <main className="page stack">
      <PageHeader title={t("settings.privacy")} />
      <Card className="stack-sm">
        <Switch
          label={t("settings.showName")}
          checked={me.show_name}
          onChange={(v) => updateMe.mutate({ show_name: v })}
        />
        <Switch
          label={t("settings.showAvatar")}
          checked={me.show_avatar}
          onChange={(v) => updateMe.mutate({ show_avatar: v })}
        />
        <div className="row-between">
          <span>{t("settings.location")}</span>
          <span className="muted">{geoLabel}</span>
        </div>
        <Link to="/settings/notifications" className="muted">
          🔔 {t("settings.notifications")} →
        </Link>
      </Card>
      <Card className="stack-sm">
        <strong>{t("settings.blocked")}</strong>
        {blocks.isPending ? (
          <Loader />
        ) : (blocks.data?.results.length ?? 0) === 0 ? (
          <EmptyState icon="🕊" title={t("settings.noBlocked")} />
        ) : (
          blocks.data?.results.map((b) => (
            <div key={b.user.id} className="row-between">
              <div className="row">
                <Avatar name={b.user.display_name} media={b.user.avatar} size={36} />
                {b.user.display_name ?? t("common.anonymous")}
              </div>
              <Button variant="ghost" size="sm" onClick={() => unblock.mutate(b.user.id)}>
                {t("settings.unblock")}
              </Button>
            </div>
          ))
        )}
      </Card>
      <Button variant="danger" onClick={() => setConfirmOpen(true)}>
        {t("settings.deactivate")}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("settings.deactivateTitle")}
        text={t("settings.deactivateText")}
        confirmLabel={t("settings.deactivateConfirm")}
        danger
        loading={deactivate.isPending}
        onConfirm={() => deactivate.mutate(undefined, { onSuccess: () => navigate("/", { replace: true }) })}
      />
    </main>
  );
}
