import { create } from "zustand";

import type { Category, Urgency } from "@/types/api";
import { CATEGORY_ORDER, URGENCIES } from "@/utils/categories";
import { NEARBY_DEFAULT_RADIUS } from "@/utils/radius";

interface NearbyFiltersState {
  radius: number;
  categories: Category[];
  urgencies: Urgency[];
  view: "list" | "map";
  setRadius: (radius: number) => void;
  toggleCategory: (category: Category) => void;
  toggleUrgency: (urgency: Urgency) => void;
  setView: (view: "list" | "map") => void;
  reset: () => void;
}

/** An empty list means «all». Unticking one from «all» keeps the rest; ticking everything is «all» again. */
const toggle = <T>(list: T[], value: T, all: readonly T[]): T[] => {
  const current = list.length ? list : [...all];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return next.length === all.length ? [] : next;
};

/** What the chips should show as ticked: everything when no filter is set. */
export const shownAsSelected = <T>(list: T[], all: readonly T[]): T[] => (list.length ? list : [...all]);

export const useNearbyFilters = create<NearbyFiltersState>((set) => ({
  radius: NEARBY_DEFAULT_RADIUS,
  categories: [],
  urgencies: [],
  view: "list",
  setRadius: (radius) => set({ radius }),
  toggleCategory: (category) => set((s) => ({ categories: toggle(s.categories, category, CATEGORY_ORDER) })),
  toggleUrgency: (urgency) => set((s) => ({ urgencies: toggle(s.urgencies, urgency, URGENCIES) })),
  setView: (view) => set({ view }),
  reset: () => set({ categories: [], urgencies: [], radius: NEARBY_DEFAULT_RADIUS }),
}));
