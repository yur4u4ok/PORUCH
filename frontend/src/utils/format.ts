import i18n, { currentLocale } from "@/i18n";
import { resolveRegion, type Region } from "@/i18n/region";

/** Formatting follows the region (country, currency, units), labels follow the UI language. */
export function region(): Region {
  return resolveRegion(currentLocale());
}

const METERS_PER_MILE = 1609.344;

function unit(value: number, unitName: string, maxFraction = 1): string {
  return new Intl.NumberFormat(region().intl, {
    style: "unit",
    unit: unitName,
    unitDisplay: "short",
    maximumFractionDigits: maxFraction,
  }).format(value);
}

/** Distance to something: "800 m", "1,2 km", "0.7 mi", "300 ft". */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return "";
  if (region().units === "imperial") {
    const miles = meters / METERS_PER_MILE;
    if (miles < 0.1) return unit(Math.max(100, Math.round((meters * 3.28084) / 100) * 100), "foot", 0);
    return unit(Math.round(miles * 10) / 10, "mile");
  }
  const rounded = Math.max(100, Math.round(meters / 100) * 100);
  if (rounded < 1000) return unit(rounded, "meter", 0);
  return unit(rounded / 1000, "kilometer");
}

/** A search/notification radius label: "3 km" or "1.9 mi". */
export function formatRadius(meters: number): string {
  if (region().units === "imperial") return unit(meters / METERS_PER_MILE, "mile");
  return meters < 1000 ? unit(meters, "meter", 0) : unit(meters / 1000, "kilometer");
}

function fractionDigits(amount: number): number {
  return Number.isInteger(amount) ? 0 : 2;
}

/** "500 грн", "10 €", "$12". The currency is the one the amount was given in, not the viewer's. */
export function formatMoney(amount: string | number, currency: string): string {
  const value = Number(amount);
  const digits = fractionDigits(value);
  const { intl } = region();
  if (currency === "UAH" && currentLocale() === "uk") {
    return `${value.toLocaleString(intl, { minimumFractionDigits: digits, maximumFractionDigits: digits })} грн`;
  }
  try {
    return new Intl.NumberFormat(intl, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

/** Short currency sign for field labels: "грн", "€", "$". */
export function currencySymbol(currency: string): string {
  if (currency === "UAH" && currentLocale() === "uk") return "грн";
  try {
    const parts = new Intl.NumberFormat(region().intl, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return i18n.t("time.justNow");
  if (minutes < 60) return i18n.t("time.minutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("time.hoursAgo", { count: hours });
  return i18n.t("time.daysAgo", { count: Math.floor(hours / 24) });
}

export function timeLeft(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, new Date(iso).getTime() - now.getTime());
  const minutes = Math.round(diff / 60000);
  if (minutes < 60) return i18n.t("time.minutes", { count: minutes });
  return i18n.t("time.hours", { count: Math.round(minutes / 60) });
}

/** "13:30" or "1:30 PM". */
export function formatTime(iso: string | Date): string {
  return new Date(iso).toLocaleTimeString(region().intl, { hour: "numeric", minute: "2-digit" });
}

/** "03.10.2026" or "10/03/2026". */
export function formatDate(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(region().intl, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Time for today, date and time otherwise. */
export function formatDateTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  return date.toDateString() === now.toDateString()
    ? formatTime(date)
    : `${formatDate(date)} ${formatTime(date)}`;
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
  );
}
