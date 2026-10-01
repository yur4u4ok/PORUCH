import { create } from "zustand";

import type { Category, Urgency } from "@/types/api";

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

const toggle = <T>(list: T[], value: T) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

export const useNearbyFilters = create<NearbyFiltersState>((set) => ({
  radius: 3000,
  categories: [],
  urgencies: [],
  view: "list",
  setRadius: (radius) => set({ radius }),
  toggleCategory: (category) => set((s) => ({ categories: toggle(s.categories, category) })),
  toggleUrgency: (urgency) => set((s) => ({ urgencies: toggle(s.urgencies, urgency) })),
  setView: (view) => set({ view }),
  reset: () => set({ categories: [], urgencies: [], radius: 3000 }),
}));
