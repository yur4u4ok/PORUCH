import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach } from "vitest";

import { setLocale } from "@/i18n";
import { useRegionStore } from "@/i18n/region";

// Tests read Ukrainian texts and Ukrainian formats unless they switch explicitly.
const resetRegion = () =>
  useRegionStore.setState({ country: "UA", currency: null, units: null, detectedCountry: null });

beforeAll(async () => {
  resetRegion();
  await setLocale("uk");
});
beforeEach(resetRegion);
afterEach(() => cleanup());
