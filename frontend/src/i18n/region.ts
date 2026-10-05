import { create } from "zustand";

import { LANGUAGES, type Locale } from "./languages";

/**
 * Regional formats (currency, units, date/time order) are independent of the UI language:
 * a Ukrainian speaker in Berlin reads Ukrainian but pays in euros.
 * Defaults follow the detected country; every part can be overridden in settings.
 */

export type Units = "metric" | "imperial";

/** Currency per country, for the countries we can reasonably expect. Unknown → USD. */
// prettier-ignore
const COUNTRY_CURRENCY: Record<string, string> = {
  UA: "UAH", US: "USD", GB: "GBP", PL: "PLN", CZ: "CZK", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK",
  HU: "HUF", RO: "RON", MD: "MDL", TR: "TRY", JP: "JPY", KR: "KRW", CN: "CNY", IN: "INR", BR: "BRL",
  MX: "MXN", CA: "CAD", AU: "AUD", GE: "GEL",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", PT: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", IE: "EUR",
  FI: "EUR", GR: "EUR", SK: "EUR", SI: "EUR", LT: "EUR", LV: "EUR", EE: "EUR", HR: "EUR", LU: "EUR",
};

/** Must match backend common/utils/money.py SUPPORTED_CURRENCIES. */
export const CURRENCIES = [...new Set(Object.values(COUNTRY_CURRENCY))].sort();
export const COUNTRIES = Object.keys(COUNTRY_CURRENCY).sort();

/** Countries where everyday distances are in miles. */
const IMPERIAL = new Set(["US", "GB", "LR", "MM"]);

const STORAGE_KEY = "poruch.region";

interface Saved {
  country: string | null;
  currency: string | null;
  units: Units | null;
  detectedCountry: string | null;
}

function read(): Saved {
  const empty: Saved = { country: null, currency: null, units: null, detectedCountry: null };
  try {
    return { ...empty, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return empty;
  }
}

interface RegionState extends Saved {
  /** null = automatic. */
  setCountry: (country: string | null) => void;
  setCurrency: (currency: string | null) => void;
  setUnits: (units: Units | null) => void;
  setDetectedCountry: (country: string | null) => void;
}

export const useRegionStore = create<RegionState>((set, get) => {
  const save = (patch: Partial<Saved>) => {
    set(patch);
    const { country, currency, units, detectedCountry } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ country, currency, units, detectedCountry }));
    } catch {
      /* storage unavailable */
    }
  };
  return {
    ...read(),
    setCountry: (country) => save({ country }),
    setCurrency: (currency) => save({ currency }),
    setUnits: (units) => save({ units }),
    setDetectedCountry: (detectedCountry) => save({ detectedCountry }),
  };
});

function browserCountry(): string | null {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const region = tag?.split("-")[1]?.toUpperCase();
    if (region && /^[A-Z]{2}$/.test(region)) return region;
  }
  return null;
}

export interface Region {
  country: string;
  currency: string;
  units: Units;
  /** BCP 47 tag for Intl, e.g. "uk-UA", "en-US", "de-DE". */
  intl: string;
}

/** Choice → detected location → browser region → the language's home country. */
export function resolveRegion(language: Locale, state: Saved = useRegionStore.getState()): Region {
  const country =
    state.country ??
    state.detectedCountry ??
    browserCountry() ??
    LANGUAGES.find((l) => l.code === language)?.country ??
    "US";
  const currency = state.currency ?? COUNTRY_CURRENCY[country] ?? "USD";
  const units = state.units ?? (IMPERIAL.has(country) ? "imperial" : "metric");
  let intl = `${language}-${country}`;
  try {
    intl = Intl.getCanonicalLocales(intl)[0] ?? language;
  } catch {
    intl = language;
  }
  return { country, currency, units, intl };
}
