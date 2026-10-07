/// <reference lib="webworker" />
/**
 * Service worker: app shell for offline use, Web Push display and notification click handling.
 * API calls are never cached (always network).
 */
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Pages: network first, so an open link always gets the current version. Serving the precached
// index.html first meant: old page → new worker deletes old chunks → «Importing a module script
// failed» on the next click. The cached shell is used only offline (or if the network is too slow).
const pages = new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 4 });
registerRoute(
  new NavigationRoute(
    async (options) => {
      try {
        const response = await pages.handle(options);
        if (response?.ok) return response;
      } catch {
        /* offline */
      }
      return (await matchPrecache("index.html")) ?? Response.error();
    },
    { denylist: [/^\/api\//, /^\/admin/, /^\/ws\//, /^\/static\//, /^\/health\//, /^\/r\//] },
  ),
);

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  notification_id?: string;
  type?: string;
}

self.addEventListener("push", (event) => {
  let data: PushPayload;
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: "Poruch", body: event.data?.text() };
  }
  const title = data.title || "Poruch";
  // renotify/vibrate are supported by browsers but missing from TypeScript's DOM types.
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body: data.body ?? "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: data.tag,
    // Same tag (e.g. several messages in one chat) would otherwise replace silently: no sound, no popup.
    renotify: Boolean(data.tag),
    vibrate: [120, 60, 120],
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data?.url as string) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // 1) find an existing app window, 2) focus it, 3) navigate; 4) otherwise open a new one.
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) {
          await (existing as WindowClient)
            .navigate(target)
            .catch(() => existing.postMessage({ type: "navigate", url: target }));
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
