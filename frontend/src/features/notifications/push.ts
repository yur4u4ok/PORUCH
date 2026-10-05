/**
 * Web Push subscription management with graceful degradation.
 * The backend subscription id is remembered per device to allow unsubscribing.
 */
import { notificationsApi } from "@/api/notifications";
import { usersApi } from "@/api/users";

const STORAGE_KEY = "poruch.pushSubscriptionId";

export type PushSupport = "supported" | "unsupported" | "ios-needs-install";

export function pushSupport(): PushSupport {
  const hasApis = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (hasApis) return "supported";
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  return isIOS && !standalone ? "ios-needs-install" : "unsupported";
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  return "Notification" in window ? Notification.permission : "unsupported";
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

/** Ask permission (if needed) and register the subscription with the backend. */
export async function enablePush(): Promise<boolean> {
  if (pushSupport() !== "supported") return false;
  const permission =
    Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return false;
  return syncPushSubscription();
}

/** Idempotently (re)send the current subscription to the backend. Call on app start. */
export async function syncPushSubscription(): Promise<boolean> {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return false;
  const { vapid_public_key } = await usersApi.config();
  if (!vapid_public_key) return false;
  const reg = await registration();
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid_public_key),
    });
  }
  const { id } = await notificationsApi.subscribePush(subscription.toJSON());
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    /* storage unavailable */
  }
  return true;
}

export async function disablePushOnThisDevice(): Promise<void> {
  if (pushSupport() !== "supported") return;
  let storedId: string | null = null;
  try {
    storedId = localStorage.getItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
  if (storedId) await notificationsApi.unsubscribePush(Number(storedId)).catch(() => undefined);
  const reg = await registration();
  const subscription = await reg.pushManager.getSubscription();
  await subscription?.unsubscribe();
}

export async function hasActivePushSubscription(): Promise<boolean> {
  if (pushSupport() !== "supported" || Notification.permission !== "granted") return false;
  const reg = await registration();
  return !!(await reg.pushManager.getSubscription());
}
