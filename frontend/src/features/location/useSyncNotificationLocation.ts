import { useEffect, useRef } from "react";

import { usersApi } from "@/api/users";
import type { GeoPosition } from "@/types/api";

const MIN_INTERVAL_MS = 30 * 60 * 1000;
const MIN_DISTANCE_M = 300;
const STORAGE_KEY = "poruch.lastSharedLocation";

function distanceMeters(a: GeoPosition, b: GeoPosition): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function readLast(): { at: number; position: GeoPosition } | null {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

/**
 * Foreground-only: when the user explicitly opens a location-based screen, share the fresh
 * position for notification matching (rate limited). No background tracking.
 */
export function useSyncNotificationLocation(position: GeoPosition | null) {
  const sent = useRef(false);
  useEffect(() => {
    if (!position || sent.current) return;
    const last = readLast();
    const due =
      !last ||
      Date.now() - last.at > MIN_INTERVAL_MS ||
      distanceMeters(last.position, position) > MIN_DISTANCE_M;
    if (!due) return;
    sent.current = true;
    void usersApi
      .updatePreferences({ location: position })
      .then(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), position }));
        } catch {
          /* ignore */
        }
      })
      .catch(() => (sent.current = false));
  }, [position]);
}
