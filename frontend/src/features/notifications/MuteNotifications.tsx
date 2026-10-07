import { useTranslation } from "react-i18next";

import { Chip } from "@/components/ui";
import { useUpdatePreferences } from "@/features/profile/hooks";
import { formatDateTime } from "@/utils/format";

type MuteOption = "1h" | "3h" | "morning" | "24h";
const OPTIONS: MuteOption[] = ["1h", "3h", "morning", "24h"];

function muteEnd(option: MuteOption): Date {
  const end = new Date();
  if (option === "morning") {
    if (end.getHours() >= 8) end.setDate(end.getDate() + 1);
    end.setHours(8, 0, 0, 0);
    return end;
  }
  const hours = { "1h": 1, "3h": 3, "24h": 24 }[option];
  return new Date(end.getTime() + hours * 3600_000);
}

/** «Не турбувати»: pause nearby-request notifications for a while. Help is on by default. */
export function MuteNotifications({ mutedUntil }: { mutedUntil: string | null }) {
  const { t } = useTranslation();
  const update = useUpdatePreferences();
  const muted = !!mutedUntil && new Date(mutedUntil) > new Date();
  return (
    <div className="stack-sm">
      <strong>🌙 {t("settings.mute")}</strong>
      <span className="muted" style={{ fontSize: 14 }}>
        {muted ? t("settings.mutedUntil", { time: formatDateTime(mutedUntil) }) : t("settings.muteHint")}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <Chip active={!muted} onClick={() => update.mutate({ muted_until: null })}>
          {t("settings.muteOff")}
        </Chip>
        {OPTIONS.map((option) => (
          <Chip key={option} onClick={() => update.mutate({ muted_until: muteEnd(option).toISOString() })}>
            {t(`settings.muteFor.${option}`)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
