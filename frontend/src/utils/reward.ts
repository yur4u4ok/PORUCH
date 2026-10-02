import type { TFunction } from "i18next";

import type { HelpRequest, HelpResponse, OfferType, RewardOption } from "@/types/api";

export const REWARD_OPTIONS: RewardOption[] = ["PIZZA", "COFFEE", "RETURN_HELP", "GIVE_ITEM"];

export const REWARD_OPTION_EMOJI: Record<RewardOption, string> = {
  PIZZA: "🍕",
  COFFEE: "☕",
  RETURN_HELP: "🤝",
  GIVE_ITEM: "🎁",
};

const money = (amount: string) => Number(amount).toLocaleString(undefined, { maximumFractionDigits: 2 });

/** What the author offers as thanks, e.g. "500 грн, 🍕 Поставлю піцу". */
export function rewardSummary(
  request: Pick<HelpRequest, "reward_type" | "reward_amount" | "reward_options">,
  t: TFunction,
): string {
  if (request.reward_type !== "WILLING") return t(`reward.${request.reward_type}`);
  const parts: string[] = [];
  if (request.reward_amount) parts.push(t("reward.money", { amount: money(request.reward_amount) }));
  request.reward_options.forEach((o) => parts.push(`${REWARD_OPTION_EMOJI[o]} ${t(`reward.options.${o}`)}`));
  return parts.join(", ");
}

/** A helper's offer, shown to the author. */
export function offerSummary(
  response: Pick<HelpResponse, "offer_type" | "offered_amount">,
  t: TFunction,
): string {
  if (response.offer_type === "COUNTER" && response.offered_amount) {
    return t("offer.counterShort", { amount: money(response.offered_amount) });
  }
  return t(`offer.short.${response.offer_type}`);
}

/** Agreed terms after the author chose a helper. */
export function agreedSummary(request: HelpRequest, t: TFunction): string | null {
  const type: OfferType | null = request.agreed_offer_type;
  if (!type || request.reward_type !== "WILLING") return null;
  if (type === "FREE") return t("offer.short.FREE");
  if (type === "COUNTER" && request.agreed_amount)
    return t("reward.money", { amount: money(request.agreed_amount) });
  return rewardSummary(request, t);
}
