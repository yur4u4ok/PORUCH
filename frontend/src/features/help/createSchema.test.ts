import { describe, expect, it } from "vitest";

import { createHelpSchema } from "./createSchema";

const valid = {
  category: "AUTO",
  subcategory: null,
  title: "",
  description: "Пробите колесо",
  location: { latitude: 49.84, longitude: 24.03, accuracy: 10 },
  urgency: "NOW",
  needed_at: "",
  helpers_needed: 1,
  active_hours: 6,
  reward_type: "NONE",
  reward_amount: "",
  reward_options: [],
  emergency_acknowledged: false,
};

describe("createHelpSchema", () => {
  it("accepts a valid request", () => {
    expect(createHelpSchema.safeParse(valid).success).toBe(true);
  });
  it("requires description and limits it to 1000 chars", () => {
    expect(createHelpSchema.safeParse({ ...valid, description: "  " }).success).toBe(false);
    expect(createHelpSchema.safeParse({ ...valid, description: "x".repeat(1001) }).success).toBe(false);
  });
  it("requires location", () => {
    const result = createHelpSchema.safeParse({ ...valid, location: null });
    expect(result.success).toBe(false);
  });
  it("requires a future date and time for SCHEDULED", () => {
    const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString().slice(0, 16);
    expect(createHelpSchema.safeParse({ ...valid, urgency: "SCHEDULED" }).success).toBe(false);
    expect(
      createHelpSchema.safeParse({ ...valid, urgency: "SCHEDULED", needed_at: inHours(-1) }).success,
    ).toBe(false);
    expect(
      createHelpSchema.safeParse({ ...valid, urgency: "SCHEDULED", needed_at: inHours(24) }).success,
    ).toBe(true);
  });
  it("validates optional reward amount", () => {
    expect(
      createHelpSchema.safeParse({ ...valid, reward_type: "WILLING", reward_amount: "150,50" }).success,
    ).toBe(true);
    expect(
      createHelpSchema.safeParse({ ...valid, reward_type: "WILLING", reward_amount: "-5" }).success,
    ).toBe(false);
  });
});
