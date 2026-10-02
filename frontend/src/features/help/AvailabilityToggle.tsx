import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BottomSheet, Button, Card, Switch } from "@/components/ui";
import { useGeolocation } from "@/features/location/useGeolocation";
import {
  useAvailability,
  useClearAvailability,
  usePreferences,
  usePublicConfig,
  useSetAvailability,
} from "@/features/profile/hooks";
import { toast } from "@/stores/toastStore";
import type { NotificationCategory } from "@/types/api";
import { formatTime } from "@/utils/format";

import { CategoryChips, RadiusChips } from "./components";
import styles from "./components.module.css";

export function AvailabilityToggle() {
  const { t } = useTranslation();
  const { data: availability } = useAvailability();
  const { data: prefs } = usePreferences();
  const { data: config } = usePublicConfig();
  const setAvailability = useSetAvailability();
  const clear = useClearAvailability();
  const { locate } = useGeolocation();
  const [open, setOpen] = useState(false);
  const [radius, setRadius] = useState(3000);
  const [categories, setCategories] = useState<NotificationCategory[]>([]);

  const active = !!availability?.active;

  const openSheet = () => {
    setRadius(prefs?.notification_radius ?? config?.default_radius ?? 3000);
    setCategories(prefs?.enabled_categories ?? []);
    setOpen(true);
  };

  const enable = async () => {
    const position = await locate({ force: true });
    if (!position) {
      toast.error(t("availability.needLocation"));
      return;
    }
    setAvailability.mutate(
      { ...position, radius, categories, duration_minutes: config?.availability_default_minutes },
      { onSuccess: () => setOpen(false) },
    );
  };

  const toggle = (c: NotificationCategory) =>
    setCategories((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]));

  return (
    <Card>
      <Switch
        label={<strong>🙋 {t("availability.title")}</strong>}
        description={
          active && availability?.expires_at
            ? t("availability.activeUntil", { time: formatTime(availability.expires_at) })
            : t("availability.off")
        }
        checked={active}
        disabled={clear.isPending || setAvailability.isPending}
        onChange={(checked) => (checked ? openSheet() : clear.mutate())}
      />
      <details className={styles.explain}>
        <summary>{t("availability.explainTitle")}</summary>
        <p>{t("availability.explain")}</p>
      </details>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("availability.title")}
        actions={
          <Button variant="help" block onClick={enable} loading={setAvailability.isPending}>
            {t("availability.enable")}
          </Button>
        }
      >
        <p className="muted">{t("availability.explain")}</p>
        <div className="stack-sm">
          <strong>{t("availability.radius")}</strong>
          <RadiusChips
            radii={config?.radii ?? [500, 1000, 3000, 5000, 10000]}
            value={radius}
            onChange={setRadius}
          />
        </div>
        <div className="stack-sm">
          <strong>{t("availability.categories")}</strong>
          <CategoryChips
            options={config?.notification_categories ?? []}
            selected={categories}
            onToggle={toggle}
            labelKey="notificationCategories"
          />
        </div>
      </BottomSheet>
    </Card>
  );
}
