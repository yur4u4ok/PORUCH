import { create } from "zustand";

import type { GeoPosition } from "@/types/api";

export type LocationStatus = "idle" | "locating" | "granted" | "denied" | "unavailable";

interface LocationState {
  position: GeoPosition | null;
  status: LocationStatus;
  updatedAt: number | null;
  setPosition: (position: GeoPosition) => void;
  setStatus: (status: LocationStatus) => void;
}

/** Last foreground position. No continuous/background tracking. */
export const useLocationStore = create<LocationState>((set) => ({
  position: null,
  status: "idle",
  updatedAt: null,
  setPosition: (position) => set({ position, status: "granted", updatedAt: Date.now() }),
  setStatus: (status) => set({ status }),
}));
