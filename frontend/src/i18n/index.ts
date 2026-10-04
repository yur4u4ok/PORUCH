import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { isLocale, type Locale } from "./languages";
import { useRegionStore } from "./region";
import en from "./locales/en.json";
import uk from "./locales/uk.json";

export { LANGUAGES, SUPPORTED_LOCALES, type Locale } from "./languages";

const STORAGE_KEY = "poruch.lang";

// English is the fallback and Ukrainian the original: both bundled. The rest load on demand.
const loaders = import.meta.glob<{ default: Record<string, unknown> }>([
  "./locales/*.json",
  "!./locales/en.json",
  "!./locales/uk.json",
]);

/** Saved choice → VITE_DEFAULT_LOCALE → Ukrainian. Other languages only by explicit choice. */
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

async function ensureLoaded(locale: Locale): Promise<void> {
  if (i18n.hasResourceBundle(locale, "translation")) return;
  const load = loaders[`./locales/${locale}.json`];
  if (load) i18n.addResourceBundle(locale, "translation", (await load()).default);
}

const syncHtmlLang = (lng: string) => document.documentElement.setAttribute("lang", lng);

const start = initialLocale();
void i18n.use(initReactI18next).init({
  resources: { uk: { translation: uk }, en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});
i18n.on("languageChanged", syncHtmlLang);
// Regional formats changed: re-render everything that uses translations (and so formatters).
useRegionStore.subscribe(() => void i18n.changeLanguage(i18n.language));

/** Resolves once the initial language is loaded; render after it to avoid a flash of English. */
export const i18nReady: Promise<unknown> = ensureLoaded(start).then(() => i18n.changeLanguage(start));

export async function setLocale(locale: Locale): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* storage unavailable: still switch for this session */
  }
  await ensureLoaded(locale);
  await i18n.changeLanguage(locale);
}

export function currentLocale(): Locale {
  const lng = i18n.language?.split("-")[0];
  return isLocale(lng) ? lng : "en";
}

export default i18n;
