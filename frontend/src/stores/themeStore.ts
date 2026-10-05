import { create } from "zustand";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "poruch.theme";
const THEME_COLORS = { light: "#0E5A54", dark: "#0F1A19" };

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function resolved(pref: ThemePreference): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Applies the theme to <html data-theme> and the browser UI colour. */
export function applyTheme(pref: ThemePreference): void {
  const root = document.documentElement;
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved(pref)]);
}

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: read(),
  setTheme: (theme) => {
    try {
      if (theme === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
    applyTheme(theme);
    set({ theme });
  },
}));
