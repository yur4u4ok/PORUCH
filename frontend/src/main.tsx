import "@/i18n";
// Before React: the browser may offer installation (beforeinstallprompt) right after load.
import "@/features/pwa/install";
import "@/styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import { applyTheme, useThemeStore } from "@/stores/themeStore";

// After a deploy, a page loaded earlier (e.g. cached by Telegram's in-app browser) may ask for JS
// chunks that no longer exist. Reload once to pick up the new version instead of showing an error.
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "poruch.chunkReloadAt";
  try {
    if (Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 10_000) return; // avoid a loop
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage unavailable: still try one reload */
  }
  event.preventDefault();
  window.location.reload();
});

applyTheme(useThemeStore.getState().theme);
window
  .matchMedia?.("(prefers-color-scheme: dark)")
  .addEventListener("change", () => applyTheme(useThemeStore.getState().theme));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
