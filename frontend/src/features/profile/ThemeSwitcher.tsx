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
/** `fallback` is the look used while the person hasn't picked a theme (the landing is dark by default). */
export function ThemeToggle({ fallback }: { fallback?: "light" | "dark" } = {}) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const dark = (theme === "system" && fallback ? fallback : resolved(theme)) === "dark";
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
