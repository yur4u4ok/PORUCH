import { describe, expect, it } from "vitest";

import { validateImageFile } from "./files";
import { formatDistance, timeAgo, timeLeft, uuid } from "./format";

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
