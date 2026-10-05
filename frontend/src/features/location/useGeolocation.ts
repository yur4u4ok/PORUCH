import { useCallback } from "react";

import { useLocationStore } from "@/stores/locationStore";
import type { GeoPosition } from "@/types/api";

const MAX_AGE_MS = 2 * 60 * 1000;

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
      return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const next = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: Math.round(pos.coords.accuracy),
            };
            setPosition(next);
            resolve(next);
          },
          (error) => {
            setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
            resolve(null);
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
