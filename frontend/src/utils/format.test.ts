import { describe, expect, it } from "vitest";

import { validateImageFile } from "./files";
import { setLocale } from "@/i18n";
import { useRegionStore } from "@/i18n/region";

import {
  formatDate,
  formatDistance,
  formatMoney,
  formatRadius,
  formatTime,
  timeAgo,
  timeLeft,
  uuid,
} from "./format";

describe("formatDistance", () => {
  it("formats meters rounded to 100 m", () => {
    expect(formatDistance(42)).toBe("100 м");
    expect(formatDistance(849)).toBe("800 м");
  });
  it("formats kilometers with one decimal", () => {
    expect(formatDistance(1234)).toBe("1,2 км");
    expect(formatDistance(999.9)).toBe("1 км");
  });
  it("handles missing distance", () => {
    expect(formatDistance(null)).toBe("");
  });
});

describe("regional formats", () => {
  const at = new Date(2026, 9, 3, 13, 30);
  const region = (country: string) => useRegionStore.setState({ country });
  // Intl uses (narrow) no-break spaces; compare with plain ones.
  const plain = (values: string[]) => values.map((v) => v.replace(/\s/g, " "));

  it("Ukraine", () => {
    expect(plain([formatMoney(500, "UAH"), formatDistance(1200), formatDate(at), formatTime(at)])).toEqual([
      "500 грн",
      "1,2 км",
      "03.10.2026",
      "13:30",
    ]);
  });

  it("Germany and the USA", async () => {
    try {
      await check();
    } finally {
      await setLocale("uk");
    }
  });

  async function check() {
    await setLocale("de");
    region("DE");
    expect(plain([formatMoney(10, "EUR"), formatDistance(1200), formatDate(at), formatTime(at)])).toEqual([
      "10 €",
      "1,2 km",
      "03.10.2026",
      "13:30",
    ]);
    await setLocale("en");
    region("US");
    expect(plain([formatMoney(12, "USD"), formatDistance(1200), formatDate(at), formatTime(at)])).toEqual([
      "$12",
      "0.7 mi",
      "10/03/2026",
      "1:30 PM",
    ]);
    expect(formatRadius(5000)).toBe("3.1 mi");
  }

  it("units can be overridden", () => {
    useRegionStore.setState({ country: "UA", units: "imperial" });
    expect(formatDistance(50).replace(/\s/g, " ")).toBe("200 фт");
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  it("uses Ukrainian plurals", () => {
    expect(timeAgo("2026-10-01T11:59:40Z", now)).toBe("щойно");
    expect(timeAgo("2026-10-01T11:55:00Z", now)).toBe("5 хвилин тому");
    expect(timeAgo("2026-10-01T10:00:00Z", now)).toBe("2 години тому");
    expect(timeAgo("2026-09-29T12:00:00Z", now)).toBe("2 дні тому");
    expect(timeAgo("2026-09-26T12:00:00Z", now)).toBe("5 днів тому");
  });
  it("time left", () => {
    expect(timeLeft("2026-10-01T18:00:00Z", now)).toBe("6 годин");
  });
});

describe("validateImageFile", () => {
  const file = (type: string, size: number) => new File([new Uint8Array(size)], "x", { type });
  it("rejects disallowed types and big files", () => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    expect(validateImageFile(file("image/svg+xml", 10), allowed, 100)).toBe("type");
    expect(validateImageFile(file("image/jpeg", 101), allowed, 100)).toBe("size");
    expect(validateImageFile(file("image/png", 100), allowed, 100)).toBeNull();
  });
});

it("generates uuids", () => {
  expect(uuid()).toMatch(/^[0-9a-f-]{36}$/);
});

describe("uploadErrorMessage", () => {
  it("explains why an upload failed", async () => {
    const { ApiError } = await import("@/api/client");
    const { uploadErrorMessage } = await import("./files");
    expect(uploadErrorMessage(new ApiError(400, { details: { size: ["x"] } }), 10)).toEqual([
      "create.photoTooLarge",
      { mb: 10 },
    ]);
    expect(uploadErrorMessage(new ApiError(400, { code: "INVALID_FILE" }), 10)).toEqual([
      "create.photoWrongType",
    ]);
    expect(uploadErrorMessage(new ApiError(0, {}), 10)).toEqual(["errors.NETWORK_ERROR"]);
    expect(uploadErrorMessage(new Error("boom"), 10)).toEqual(["create.photoUploadFailed"]);
  });
});
