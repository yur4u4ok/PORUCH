import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui";
import type { Capability } from "@/types/api";

import styles from "@/pages/Profile/Profile.module.css";

export function CapabilityList({ capabilities }: { capabilities: Capability[] }) {
  const { t } = useTranslation();
  const help = capabilities.filter((c) => c.kind === "HELP");
  const items = capabilities.filter((c) => c.kind === "ITEM");
  return (
    <div className="stack-sm">
      {help.length > 0 && (
        <>
          <strong>{t("profile.canHelp")}</strong>
          <div className={styles.caps}>
            {help.map((c) => (
              <Badge key={c.code}>
                {c.emoji} {t(`capabilities.${c.code}`)}
              </Badge>
            ))}
          </div>
        </>
      )}
      {items.length > 0 && (
        <>
          <strong>{t("profile.has")}</strong>
          <div className={styles.caps}>
            {items.map((c) => (
              <Badge key={c.code}>
                {c.emoji} {t(`capabilities.${c.code}`)}
              </Badge>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
