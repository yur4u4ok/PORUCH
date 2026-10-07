import type { TFunction } from "i18next";

import { formatMoney } from "@/utils/format";
import type { AgreedTerms, HelpRequest, HelpResponse, OfferType, RewardOption } from "@/types/api";

export const REWARD_OPTIONS: RewardOption[] = ["PIZZA", "COFFEE", "RETURN_HELP", "GIVE_ITEM"];

/** Same icons as on the create form: ❤️ no payment, 💰 ready to thank, 🍫 a small thank-you. */
export const REWARD_TYPE_EMOJI = { NONE: "❤️", WILLING: "💰", UNSURE: "🍫" } as const;

export const REWARD_OPTION_EMOJI: Record<RewardOption, string> = {
  PIZZA: "🍕",
  COFFEE: "☕",
  RETURN_HELP: "🤝",
  GIVE_ITEM: "🎁",
};

/** What the author offers as thanks, e.g. "500 грн, 🍕 Поставлю піцу" (amount in the request's currency). */
export function rewardSummary(
  request: Pick<HelpRequest, "reward_type" | "reward_amount" | "reward_options" | "reward_currency">,
  t: TFunction,
): string {
  if (request.reward_type !== "WILLING") return t(`reward.${request.reward_type}`);
  const parts: string[] = [];
  if (request.reward_amount) parts.push(formatMoney(request.reward_amount, request.reward_currency));
  request.reward_options.forEach((o) => parts.push(`${REWARD_OPTION_EMOJI[o]} ${t(`reward.options.${o}`)}`));
  return parts.join(", ");
}

/** A helper's offer, shown to the author. */
export function offerSummary(
  response: Pick<HelpResponse, "offer_type" | "offered_amount">,
  currency: string,
  t: TFunction,
): string {
  if (response.offer_type === "COUNTER" && response.offered_amount) {
    return t("offer.counterShort", { amount: formatMoney(response.offered_amount, currency) });
  }
  return t(`offer.short.${response.offer_type}`);
}

/** Terms agreed with a helper (defaults to the request's own, i.e. the first helper). */
export function agreedSummary(
  request: HelpRequest,
  t: TFunction,
  terms: AgreedTerms = request,
): string | null {
  const type: OfferType | null = terms.agreed_offer_type;
  if (!type || request.reward_type !== "WILLING") return null;
  if (type === "FREE") return t("offer.short.FREE");
  if (type === "COUNTER" && terms.agreed_amount)
    return formatMoney(terms.agreed_amount, request.reward_currency);
  return rewardSummary(request, t);
}
