/** UI languages. Names are shown in their own language so anyone can find theirs. */
export const LANGUAGES = [
  { code: "uk", name: "Українська", short: "UA", country: "UA" },
  { code: "en", name: "English", short: "EN", country: "US" },
  { code: "es", name: "Español", short: "ES", country: "ES" },
  { code: "de", name: "Deutsch", short: "DE", country: "DE" },
  { code: "fr", name: "Français", short: "FR", country: "FR" },
  { code: "pl", name: "Polski", short: "PL", country: "PL" },
  { code: "pt", name: "Português", short: "PT", country: "PT" },
  { code: "it", name: "Italiano", short: "IT", country: "IT" },
  { code: "tr", name: "Türkçe", short: "TR", country: "TR" },
  { code: "ja", name: "日本語", short: "JA", country: "JP" },
  { code: "ko", name: "한국어", short: "KO", country: "KR" },
  { code: "zh", name: "中文", short: "ZH", country: "CN" },
  { code: "hi", name: "हिन्दी", short: "HI", country: "IN" },
] as const;

export type Locale = (typeof LANGUAGES)[number]["code"];
export const SUPPORTED_LOCALES = LANGUAGES.map((l) => l.code) as Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as string[]).includes(value);
}
