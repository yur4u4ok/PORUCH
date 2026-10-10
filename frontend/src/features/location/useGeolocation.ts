import { useCallback } from "react";

import { useLocationStore } from "@/stores/locationStore";
import type { GeoPosition } from "@/types/api";

const MAX_AGE_MS = 2 * 60 * 1000;
/** A fix this precise is good enough to stop waiting. */
const GOOD_ACCURACY_M = 30;
/** Longest we keep refining before using the best fix so far. */
const REFINE_MS = 8000;

/** One-shot foreground geolocation (navigator.geolocation.getCurrentPosition). */
export function useGeolocation() {
  const { position, status, updatedAt, setPosition, setStatus } = useLocationStore();

  const locate = useCallback(
    (options: { force?: boolean } = {}): Promise<GeoPosition | null> => {
      const state = useLocationStore.getState();
      if (!options.force && state.position && state.updatedAt && Date.now() - state.updatedAt < MAX_AGE_MS) {
        return Promise.resolve(state.position);
      }
      if (!("geolocation" in navigator)) {
        setStatus("unavailable");
        return Promise.resolve(null);
      }
      setStatus("locating");
      // The first fix a phone reports is often a rough Wi-Fi/cell guess (hundreds of metres off);
      // GPS sharpens it within seconds. Watch briefly and keep the best fix: done as soon as it is
      // precise enough, otherwise after REFINE_MS with whatever is best by then.
      return new Promise((resolve) => {
        let best: GeoPosition | null = null;
        let watchId: number | null = null;
        let finished = false;
        const finish = (result: GeoPosition | null, error?: GeolocationPositionError) => {
          if (finished) return;
          finished = true;
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          clearTimeout(timer);
          if (result) setPosition(result);
          else setStatus(error?.code === error?.PERMISSION_DENIED ? "denied" : "unavailable");
          resolve(result);
        };
        const timer = setTimeout(() => finish(best), REFINE_MS);
        watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const next = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
            };
            if (!best || (next.accuracy ?? Infinity) <= (best.accuracy ?? Infinity)) {
              best = next;
              setPosition(next); // the map follows the fix as it improves
            }
            if ((next.accuracy ?? Infinity) <= GOOD_ACCURACY_M) finish(next);
          },
          (error) => {
            // A failure after some fix already arrived just ends the wait with that fix.
            if (best) finish(best);
            else finish(null, error);
          },
          // A forced request must be a fresh fix, never one the browser cached earlier.
          { enableHighAccuracy: true, timeout: 15000, maximumAge: options.force ? 0 : 60000 },
        );
      });
    },
    [setPosition, setStatus],
  );

  return { position, status, updatedAt, locate };
}

export async function geolocationPermission(): Promise<PermissionState | "unsupported"> {
  try {
    if (!navigator.permissions) return "unsupported";
    const result = await navigator.permissions.query({ name: "geolocation" });
    return result.state;
  } catch {
    return "unsupported";
  }
}
