import { describe, expect, it } from "vitest";

import { useThemeStore } from "./themeStore";

describe("theme store", () => {
  it("starts light when nothing was picked", () => {
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("applies and persists every choice, system included", () => {
    useThemeStore.getState().setTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("poruch.theme")).toBe("dark");
    useThemeStore.getState().setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    useThemeStore.getState().setTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("poruch.theme")).toBe("system");
  });
});
