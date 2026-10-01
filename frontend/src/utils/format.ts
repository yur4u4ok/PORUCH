import i18n from "@/i18n";

export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return "";
  const rounded = Math.max(100, Math.round(meters / 100) * 100);
  if (rounded < 1000) return i18n.t("common.m", { value: rounded });
  const km = (rounded / 1000).toLocaleString("uk-UA", { maximumFractionDigits: 1 });
  return i18n.t("common.km", { value: km });
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

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "long", year: "numeric" });
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ ((Math.random() * 16) >> (Number(c) / 4))).toString(16),
  );
}
