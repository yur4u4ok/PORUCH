import { describe, expect, it } from "vitest";

import i18n from "@/i18n";
import type { HelpRequest } from "@/types/api";

import { agreedSummary, offerSummary, rewardSummary } from "./reward";

const t = i18n.t.bind(i18n);
const base = {
  reward_type: "WILLING",
  reward_amount: "500.00",
  reward_options: ["PIZZA", "COFFEE"],
} as const;

describe("reward formatting", () => {
  it("summarizes amount and options", () => {
    expect(rewardSummary({ ...base, reward_options: [...base.reward_options] }, t)).toBe(
      "500 грн, 🍕 Поставлю піцу, ☕ Кава",
    );
    expect(
      rewardSummary({ reward_type: "WILLING", reward_amount: null, reward_options: ["GIVE_ITEM"] }, t),
    ).toBe("🎁 Віддам/позичу річ");
    expect(rewardSummary({ reward_type: "NONE", reward_amount: null, reward_options: [] }, t)).toBe(
      "Без оплати",
    );
  });

  it("describes offers and agreements", () => {
    expect(offerSummary({ offer_type: "COUNTER", offered_amount: "400.00" }, t)).toBe("Пропонує 400 грн");
    expect(offerSummary({ offer_type: "FREE", offered_amount: null }, t)).toBe("Без оплати");
    const request = {
      ...base,
      reward_options: ["PIZZA"],
      agreed_offer_type: "COUNTER",
      agreed_amount: "400.00",
    } as unknown as HelpRequest;
    expect(agreedSummary(request, t)).toBe("400 грн");
    expect(agreedSummary({ ...request, agreed_offer_type: null }, t)).toBeNull();
  });
});
