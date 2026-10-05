import type { Category, Urgency } from "@/types/api";

export const CATEGORY_ORDER: Category[] = [
  "AUTO",
  "HOME",
  "ITEMS",
  "ANIMALS",
  "PEOPLE",
  "DISTRICT",
  "URGENT",
  "OTHER",
];

export const CATEGORY_EMOJI: Record<Category, string> = {
  AUTO: "🚗",
  HOME: "🏠",
  ITEMS: "📦",
  ANIMALS: "🐕",
  PEOPLE: "👨",
  DISTRICT: "📍",
  URGENT: "🚨",
  OTHER: "✨",
};

export const SUBCATEGORY_EMOJI: Record<string, string> = {
  FLAT_TIRE: "🛞",
  DEAD_BATTERY: "🔋",
  JUMPER_CABLES: "🔌",
  OUT_OF_FUEL: "⛽",
  TOWING: "🚛",
  NEED_TOOL: "🔧",
  BORROW_TOOL: "🔧",
  LOST_PET: "🐾",
  FOUND_PET: "🐾",
  MOVING: "📦",
  CARRY_HEAVY: "🏋️",
};

export const URGENCY_EMOJI: Record<Urgency, string> = { NOW: "🔴", TODAY: "🟡", WHENEVER: "🟢" };

export const URGENCY_COLOR: Record<Urgency, string> = {
  NOW: "var(--color-urgent-now)",
  TODAY: "var(--color-urgent-today)",
  WHENEVER: "var(--color-urgent-whenever)",
};

/** Raw colors for MapLibre DOM markers (CSS vars resolve too, but keep explicit for contrast). */
export const URGENCY_HEX: Record<Urgency, string> = { NOW: "#b54708", TODAY: "#a87a12", WHENEVER: "#1f7a4d" };

export function requestEmoji(category: Category, subcategory?: string | null): string {
  return (subcategory && SUBCATEGORY_EMOJI[subcategory]) || CATEGORY_EMOJI[category];
}
