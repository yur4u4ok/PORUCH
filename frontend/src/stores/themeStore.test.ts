import { describe, expect, it } from "vitest";

import { useThemeStore } from "./themeStore";

describe("theme store", () => {
  it("applies and persists explicit themes, clears for system", () => {
    useThemeStore.getState().setTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("poruch.theme")).toBe("dark");
    useThemeStore.getState().setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    useThemeStore.getState().setTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("poruch.theme")).toBeNull();
  });
});
