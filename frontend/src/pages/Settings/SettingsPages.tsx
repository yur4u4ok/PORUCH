import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { PageHeader } from "@/components/layout/AppLayout";
import { ApiError } from "@/api/client";
import { Avatar, Button, Card, EmptyState, Input, Loader, Modal, Switch } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { CategoryChips, ConfirmDialog, RadiusChips } from "@/features/help/components";
import { SelectAll } from "@/features/help/SelectAll";
import { playChime, setSoundEnabled, soundEnabled } from "@/features/attention/sound";
import { geolocationPermission, useGeolocation } from "@/features/location/useGeolocation";
import { MuteNotifications } from "@/features/notifications/MuteNotifications";
import { PushToggle } from "@/features/notifications/PushToggle";
import {
  useBlocks,
  useChangePassword,
  useDeactivate,
  usePreferences,
  usePublicConfig,
  useUnblockUser,
  useUpdatePreferences,
} from "@/features/profile/hooks";
import { LanguageSwitcher } from "@/features/profile/LanguageSwitcher";
import { InstallCard } from "@/features/pwa/InstallPrompt";
import { RegionSettings } from "@/features/profile/RegionSettings";
import { ThemeSwitcher } from "@/features/profile/ThemeSwitcher";
import { toast } from "@/stores/toastStore";
import type { NotificationCategory } from "@/types/api";
import { DEFAULT_RADII } from "@/utils/radius";

export function SettingsPage() {
  const { t } = useTranslation();
  return (
    <main className="page stack">
      <PageHeader title={t("settings.title")} />
      <InstallCard />
      <Card className="stack-sm">
        <strong>{t("settings.language")}</strong>
        <LanguageSwitcher />
      </Card>
      <Card className="stack-sm">
        <strong>{t("settings.region")}</strong>
        <RegionSettings />
      </Card>
      <Card className="stack-sm">
        <strong>{t("settings.theme")}</strong>
        <ThemeSwitcher />
      </Card>
      <Card to="/settings/notifications">🔔 {t("settings.notifications")}</Card>
      <Card to="/settings/privacy">🔒 {t("settings.privacy")}</Card>
      <Card to="/support">💬 {t("support.title")}</Card>
      <Card to="/privacy">📄 {t("legal.privacy")}</Card>
      <Card to="/terms">📄 {t("legal.terms")}</Card>
    </main>
  );
}

export function NotificationSettingsPage() {
  const [sound, setSound] = useState(soundEnabled);
  const { t } = useTranslation();
  const { data: prefs, isPending } = usePreferences();
  const { data: config } = usePublicConfig();
  const update = useUpdatePreferences();
  const { locate, status } = useGeolocation();
  const [geoState, setGeoState] = useState<string>("granted");

  useEffect(() => {
    void geolocationPermission().then(setGeoState);
  }, []);

  if (isPending || !prefs) return <Loader />;

  const toggleCategory = (c: NotificationCategory) => {
    const next = prefs.enabled_categories.includes(c)
      ? prefs.enabled_categories.filter((x) => x !== c)
      : [...prefs.enabled_categories, c];
    update.mutate({ enabled_categories: next });
  };

  const allowLocation = async () => {
    const position = await locate({ force: true });
    if (position) {
      setGeoState("granted");
      update.mutate({ location: position });
    }
  };

  return (
    <main className="page stack">
      <PageHeader title={t("settings.notifications")} />
      <Card className="stack-sm">
        <PushToggle hideWhenActive />
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
        <Switch
          label={t("settings.sound")}
          description={t("settings.soundHint")}
          checked={sound}
          onChange={(v) => {
            setSoundEnabled(v);
            setSound(v);
            if (v) playChime();
          }}
        />
      </Card>
      <Card>
        <MuteNotifications mutedUntil={prefs.muted_until} />
      </Card>
      <Card className="stack-sm">
        <strong>{t("settings.radius")}</strong>
        <RadiusChips
          radii={config?.radii ?? DEFAULT_RADII}
          value={prefs.notification_radius}
          onChange={(r) => update.mutate({ notification_radius: r })}
        />
      </Card>
      <Card className="stack-sm">
        <strong>{t("settings.categories")}</strong>
        <SelectAll
          all={config?.notification_categories ?? []}
          selected={prefs.enabled_categories}
          onChange={(next) => update.mutate({ enabled_categories: next })}
        />
        <CategoryChips
          options={config?.notification_categories ?? []}
          selected={prefs.enabled_categories}
          onToggle={toggleCategory}
          labelKey="notificationCategories"
        />
      </Card>
      <Card className="stack-sm">
        <span className="muted" style={{ fontSize: 14 }}>
          📍 {geoState === "denied" ? t("settings.locationAutoDenied") : t("settings.locationAuto")}
        </span>
        {geoState === "prompt" && (
          <Button variant="secondary" onClick={allowLocation} loading={status === "locating"}>
            {t("nearby.allowLocation")}
          </Button>
        )}
      </Card>
    </main>
  );
}

/** Change the password (or set a first one for accounts made with Google). */
function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useTranslation();
  const change = useChangePassword();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const errors = change.error instanceof ApiError ? change.error.fieldErrors() : {};
  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    change.reset();
  };
  const save = () =>
    change.mutate(
      { current_password: hasPassword ? current : undefined, new_password: next },
      {
        onSuccess: () => {
          toast.success(t("settings.passwordChanged"));
          close();
        },
      },
    );
  return (
    <Card className="stack-sm">
      <div className="row-between">
        <span>🔑 {t("auth.password")}</span>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          {hasPassword ? t("settings.changePassword") : t("settings.setPassword")}
        </Button>
      </div>
      <Modal
        open={open}
        onClose={close}
        title={hasPassword ? t("settings.changePassword") : t("settings.setPassword")}
        actions={
          <>
            <Button variant="ghost" onClick={close}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} loading={change.isPending} disabled={next.length < 8}>
              {t("common.save")}
            </Button>
          </>
        }
      >
        <div className="stack">
          {hasPassword && (
            <Input
              label={t("settings.currentPassword")}
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              error={errors.current_password}
            />
          )}
          <Input
            label={t("settings.newPassword")}
            type="password"
            autoComplete="new-password"
            hint={t("auth.passwordHint")}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            error={errors.new_password}
          />
          <p className="muted" style={{ fontSize: 13 }}>
            {t("settings.passwordOtherDevices")}
          </p>
        </div>
      </Modal>
    </Card>
  );
}

export function PrivacySettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: me } = useMe();
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
        <div className="row-between">
          <span>📍 {t("settings.location")}</span>
          <span className="muted">{geoLabel}</span>
        </div>
      </Card>
      <Card to="/settings/notifications">
        <div className="row-between">
          <span>🔔 {t("settings.notifications")}</span>
          <span aria-hidden className="muted" style={{ fontSize: 22, lineHeight: 1 }}>
            ›
          </span>
        </div>
      </Card>
      <PasswordCard hasPassword={me.has_password} />
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
