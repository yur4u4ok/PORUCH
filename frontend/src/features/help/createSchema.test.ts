import { describe, expect, it } from "vitest";

import { createHelpSchema } from "./createSchema";

const valid = {
  category: "AUTO",
  subcategory: null,
  title: "",
  description: "Пробите колесо",
  location: { latitude: 49.84, longitude: 24.03, accuracy: 10 },
  urgency: "NOW",
  reward_type: "NONE",
  reward_amount: "",
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
  it("validates optional reward amount", () => {
    expect(
      createHelpSchema.safeParse({ ...valid, reward_type: "WILLING", reward_amount: "150,50" }).success,
    ).toBe(true);
    expect(
      createHelpSchema.safeParse({ ...valid, reward_type: "WILLING", reward_amount: "-5" }).success,
    ).toBe(false);
  });
});
