import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import uk from "./locales/uk.json";

export const SUPPORTED_LOCALES = ["uk"] as const; // en, pl: add locales/<code>.json and list here
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const fallback: Locale = "uk";
const envLocale = import.meta.env.VITE_DEFAULT_LOCALE as Locale | undefined;

void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk } },
  lng: envLocale && SUPPORTED_LOCALES.includes(envLocale) ? envLocale : fallback,
  fallbackLng: fallback,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
