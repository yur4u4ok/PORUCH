import { useTranslation } from "react-i18next";

import { Tabs } from "@/components/ui";
import { setLocale, type Locale } from "@/i18n";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  return (
    <Tabs<Locale>
      value={i18n.language as Locale}
      onChange={setLocale}
      ariaLabel={t("settings.language")}
      options={[
        { value: "uk", label: compact ? "UA" : t("settings.languageUk") },
        { value: "en", label: compact ? "EN" : t("settings.languageEn") },
      ]}
    />
  );
}
