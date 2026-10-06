import "@/i18n";
// Before React: the browser may offer installation (beforeinstallprompt) right after load.
import "@/features/pwa/install";
import "@/styles/global.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app/App";
import { applyTheme, useThemeStore } from "@/stores/themeStore";

applyTheme(useThemeStore.getState().theme);
window
  .matchMedia?.("(prefers-color-scheme: dark)")
  .addEventListener("change", () => applyTheme(useThemeStore.getState().theme));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
