import { expect, it } from "vitest";

import { cityName } from "./city";

it("localizes city names with fallback", () => {
  const lviv = { name: "Львів", translations: { en: "Lviv" } };
  expect(cityName(lviv, "en")).toBe("Lviv");
  expect(cityName(lviv, "uk")).toBe("Львів");
  expect(cityName(lviv, "pl")).toBe("Львів");
});
