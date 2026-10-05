import { afterEach, describe, expect, it } from "vitest";

import en from "./locales/en.json";
import uk from "./locales/uk.json";

import i18n, { LANGUAGES, setLocale } from ".";

type Tree = { [key: string]: string | string[] | Tree };
const PLURAL = /_(zero|one|two|few|many|other)$/;

function entries(tree: Tree, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => {
    if (Array.isArray(v)) return v.map((item, i) => [`${prefix}${k}.${i}`, item] as [string, string]);
    if (typeof v === "object") return entries(v, `${prefix}${k}.`);
    return [[`${prefix}${k}`, v] as [string, string]];
  });
}
const keys = (tree: Tree) => new Set(entries(tree).map(([k]) => k.replace(PLURAL, "")));
const vars = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

const files = import.meta.glob<Tree>("./locales/*.json", { eager: true, import: "default" });

describe("translations", () => {
  const reference = keys(en as Tree);
  const referenceVars = new Map(entries(en as Tree).map(([k, v]) => [k.replace(PLURAL, ""), vars(v)]));

  it("exist for every language", () => {
    expect(
      Object.keys(files)
        .map((f) => f.match(/(\w+)\.json$/)![1])
        .sort(),
    ).toEqual(LANGUAGES.map((l) => l.code).sort());
  });

  it.each(LANGUAGES.map((l) => l.code))("%s has exactly the English keys and placeholders", (code) => {
    const tree = files[`./locales/${code}.json`]!;
    const own = keys(tree);
    expect([...reference].filter((k) => !own.has(k))).toEqual([]);
    expect([...own].filter((k) => !reference.has(k))).toEqual([]);
    const mismatched = entries(tree)
      .map(([k, v]) => [k.replace(PLURAL, ""), vars(v)] as const)
      // Plural forms may omit {{count}} (e.g. "one" written as a word).
      .filter(([k, v]) => {
        const expected = referenceVars.get(k)!.filter((name) => name !== "count");
        return expected.some((name) => !v.includes(name));
      })
      .map(([k]) => k);
    expect(mismatched).toEqual([]);
  });
});

describe("i18n", () => {
  afterEach(() => setLocale("uk"));

  it("switches language, loads it on demand and persists it", async () => {
    await setLocale("en");
    expect(i18n.t("home.needHelp")).toBe("I need help");
    expect(localStorage.getItem("poruch.lang")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    await setLocale("de");
    expect(i18n.t("home.needHelp")).not.toBe("I need help");
    await setLocale("uk");
    expect(i18n.t("home.needHelp")).toBe("Потрібна допомога");
  });
});

describe("brand", () => {
  it("is not translatable", () => {
    for (const tree of [uk, en] as { app: Record<string, string> }[]) expect(tree.app.name).toBeUndefined();
  });
});
