import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import uk from "./locales/uk.json";

export const SUPPORTED_LOCALES = ["uk", "en"] as const; // add pl: locales/pl.json + list here
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = "poruch.lang";
const INTL_LOCALE: Record<Locale, string> = { uk: "uk-UA", en: "en-GB" };

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  const env = import.meta.env.VITE_DEFAULT_LOCALE;
  return isLocale(env) ? env : "uk";
}

void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk }, en: { translation: en } },
  lng: initialLocale(),
  fallbackLng: "uk",
  interpolation: { escapeValue: false },
  returnNull: false,
});

const syncHtmlLang = (lng: string) => document.documentElement.setAttribute("lang", lng);
syncHtmlLang(i18n.language);
i18n.on("languageChanged", syncHtmlLang);

export function setLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable: still switch for this session */
  }
  void i18n.changeLanguage(locale);
}

/** BCP 47 locale for dates and numbers (Intl). */
export function intlLocale(): string {
  return INTL_LOCALE[isLocale(i18n.language) ? i18n.language : "uk"];
}

export default i18n;
