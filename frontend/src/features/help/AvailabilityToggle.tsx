import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BottomSheet, Button, Card, Chip, Switch } from "@/components/ui";
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
import { DEFAULT_RADII } from "@/utils/radius";

import { CategoryChips, RadiusChips } from "./components";
import { SelectAll } from "./SelectAll";
import styles from "./components.module.css";

/** How long to receive nearby requests (the backend allows up to 12 hours). */
const DURATIONS = [30, 60, 120, 240, 480, 720];

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
  const [minutes, setMinutes] = useState(120);
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
      { ...position, radius, categories, duration_minutes: minutes },
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
          <RadiusChips radii={config?.radii ?? DEFAULT_RADII} value={radius} onChange={setRadius} />
        </div>
        <div className="stack-sm">
          <strong>{t("availability.duration")}</strong>
          <div className={styles.chips} role="radiogroup" aria-label={t("availability.duration")}>
            {DURATIONS.map((m) => (
              <Chip key={m} active={minutes === m} onClick={() => setMinutes(m)}>
                {m < 60 ? t("time.minutes", { count: m }) : t("time.hours", { count: m / 60 })}
              </Chip>
            ))}
          </div>
        </div>
        <div className="stack-sm">
          <strong>{t("availability.categories")}</strong>
          <SelectAll
            all={config?.notification_categories ?? []}
            selected={categories}
            onChange={setCategories}
          />
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
