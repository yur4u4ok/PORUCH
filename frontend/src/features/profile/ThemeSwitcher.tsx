import { useTranslation } from "react-i18next";

import { Tabs } from "@/components/ui";
import { useThemeStore, type ThemePreference } from "@/stores/themeStore";

export function ThemeSwitcher() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <Tabs<ThemePreference>
      value={theme}
      onChange={setTheme}
      ariaLabel={t("settings.theme")}
      options={[
        { value: "light", label: `☀️ ${t("settings.themeLight")}` },
        { value: "dark", label: `🌙 ${t("settings.themeDark")}` },
        { value: "system", label: t("settings.themeSystem") },
      ]}
    />
  );
}
