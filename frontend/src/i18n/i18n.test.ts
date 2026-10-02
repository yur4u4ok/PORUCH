import { afterEach, describe, expect, it } from "vitest";

import en from "./locales/en.json";
import uk from "./locales/uk.json";

import i18n, { setLocale } from ".";

type Tree = { [key: string]: string | string[] | Tree };
const keys = (tree: Tree, prefix = ""): string[] =>
  Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "object" && !Array.isArray(v)
      ? keys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`.replace(/_(one|few|many|other)$/, "")],
  );

describe("i18n", () => {
  afterEach(() => setLocale("uk"));

  it("English covers every Ukrainian key", () => {
    const english = new Set(keys(en as Tree));
    expect(keys(uk as Tree).filter((key) => !english.has(key))).toEqual([]);
  });

  it("switches language and persists it", () => {
    setLocale("en");
    expect(i18n.t("home.needHelp")).toBe("I need help");
    expect(localStorage.getItem("poruch.lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    setLocale("uk");
    expect(i18n.t("home.needHelp")).toBe("Потрібна допомога");
  });
});

describe("brand", () => {
  it("is not translatable", () => {
    expect((uk as { app: Record<string, string> }).app.name).toBeUndefined();
    expect((en as { app: Record<string, string> }).app.name).toBeUndefined();
  });
});
