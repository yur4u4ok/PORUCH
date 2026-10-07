import { useTranslation } from "react-i18next";

import { Tabs } from "@/components/ui";
import { resolved, useThemeStore, type ThemePreference } from "@/stores/themeStore";

import styles from "./LanguageSwitcher.module.css";

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

/** One tap between light and dark (for the signed-out start page, next to the language). */
export function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const dark = resolved(theme) === "dark";
  return (
    <button
      type="button"
      className={styles.compact}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? t("settings.themeLight") : t("settings.themeDark")}
      title={dark ? t("settings.themeLight") : t("settings.themeDark")}
    >
      <span aria-hidden>{dark ? "☀️" : "🌙"}</span>
    </button>
  );
}
