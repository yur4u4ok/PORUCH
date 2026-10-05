import { useTranslation } from "react-i18next";

import { Select } from "@/components/ui";
import { currentLocale, LANGUAGES, setLocale, type Locale } from "@/i18n";

import styles from "./LanguageSwitcher.module.css";

/** Language picker. Names are in their own language, so anyone can find theirs. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const value = i18n.language ? currentLocale() : "en";
  const options = LANGUAGES.map((l) => (
    <option key={l.code} value={l.code} lang={l.code}>
      {l.name}
    </option>
  ));
  if (compact) {
    return (
      <label className={styles.compact}>
        <span aria-hidden>🌐</span>
        <select
          aria-label={t("settings.language")}
          value={value}
          onChange={(e) => void setLocale(e.target.value as Locale)}
        >
          {options}
        </select>
      </label>
    );
  }
  return (
    <Select
      aria-label={t("settings.language")}
      value={value}
      onChange={(e) => void setLocale(e.target.value as Locale)}
    >
      {options}
    </Select>
  );
}
