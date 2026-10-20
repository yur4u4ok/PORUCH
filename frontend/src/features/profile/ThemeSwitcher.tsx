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
      {/* drawn icons: emoji glyphs carry uneven side bearings and never sit centred */}
      {dark ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
          <path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8z" />
        </svg>
      )}
    </button>
  );
}
