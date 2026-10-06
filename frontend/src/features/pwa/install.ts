import { useSyncExternalStore } from "react";

/**
 * PWA installation state. `beforeinstallprompt` (Chrome, Edge, Samsung Internet on Android and
 * desktop) can fire before React mounts, so it is captured at module load (imported from main.tsx).
 * Safari/iOS has no such event: there we can only explain "Share → Add to Home Screen".
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type Platform = "ios" | "ios-other-browser" | "android" | "desktop";

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own prompt at a better moment
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

/** Running as the installed app (home-screen icon), not in a browser tab. */
export function isStandalone(): boolean {
  return (
    installed ||
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function detectPlatform(ua = navigator.userAgent): Platform {
  // iPadOS reports itself as a Mac; touch points tell them apart.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "ios-other-browser" : "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/** Shows the browser's own install dialog when available. Resolves true if the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = null;
  emit();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === "accepted";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallState() {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null);
  const standalone = useSyncExternalStore(subscribe, isStandalone);
  return { canPrompt, standalone, platform: detectPlatform() };
}

const DISMISS_KEY = "poruch.installDismissedAt";
const REMIND_AFTER_MS = 3 * 24 * 3600_000;

export function dismissedRecently(now = Date.now()): boolean {
  try {
    return now - Number(localStorage.getItem(DISMISS_KEY) ?? 0) < REMIND_AFTER_MS;
  } catch {
    return false;
  }
}

export function rememberDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}
