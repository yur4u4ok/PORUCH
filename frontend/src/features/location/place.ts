import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRegionStore } from "@/i18n/region";
import { useLocationStore } from "@/stores/locationStore";
import type { LatLng } from "@/types/api";

import { geolocationPermission } from "./useGeolocation";

/** Where the user is, in human terms. Only used for display and as an approximate fallback centre. */
export interface Place {
  name: string;
  countryCode: string;
  center: LatLng;
  /** true when based on device geolocation, false when guessed from the IP address. */
  precise: boolean;
}

const ENDPOINT = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const CACHE_KEY = "poruch.place";

interface ReverseGeocodeResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Reverse geocoding without an API key (BigDataCloud client endpoint).
 * Without coordinates it falls back to the IP address — city-level, no permission prompt.
 */
export async function reverseGeocode(
  language: string,
  coords?: LatLng | null,
  signal?: AbortSignal,
): Promise<Place | null> {
  const params = new URLSearchParams({ localityLanguage: language });
  if (coords) {
    params.set("latitude", coords.latitude.toFixed(4));
    params.set("longitude", coords.longitude.toFixed(4));
  }
  const response = await fetch(`${ENDPOINT}?${params}`, { signal });
  if (!response.ok) return null;
  const data = (await response.json()) as ReverseGeocodeResponse;
  const name = data.city || data.locality || data.principalSubdivision;
  if (!name || data.latitude == null || data.longitude == null) return null;
  return {
    name,
    countryCode: (data.countryCode ?? "").toUpperCase(),
    center: coords ?? { latitude: data.latitude, longitude: data.longitude },
    precise: Boolean(coords),
  };
}

/** Place name for a point, giving up quickly: it is a nice-to-have label, never a blocker. */
export async function placeNameFor(language: string, coords: LatLng, timeoutMs = 3000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return (await reverseGeocode(language, coords, controller.signal))?.name ?? "";
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function cached(): Place | undefined {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
}

const round = (value: number) => Math.round(value * 50) / 50; // ~2 km cells: no refetch on every GPS jitter

/** The user's real location: device geolocation when already allowed, otherwise the IP address. */
export function usePlace() {
  const { i18n } = useTranslation();
  const mapPosition = useLocationStore((s) => s.position);
  // Own coarse fix, kept out of the shared store: the map must always ask for a fresh, precise one.
  const [coarse, setCoarse] = useState<LatLng | null>(null);
  const position = mapPosition ?? coarse;
  const setDetectedCountry = useRegionStore((s) => s.setDetectedCountry);

  // Never prompts: only reads the position when permission was granted before.
  useEffect(() => {
    if (position) return;
    void geolocationPermission().then((state) => {
      if (state !== "granted") return;
      navigator.geolocation.getCurrentPosition(
        (pos) => setCoarse({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => undefined,
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
      );
    });
  }, [position]);

  const cell = position ? [round(position.latitude), round(position.longitude)] : null;
  const query = useQuery({
    queryKey: ["place", i18n.language, cell],
    queryFn: ({ signal }) =>
      reverseGeocode(i18n.language, cell ? { latitude: cell[0]!, longitude: cell[1]! } : null, signal),
    staleTime: 60 * 60 * 1000,
    retry: 1,
    placeholderData: (previous) => previous ?? cached(),
    meta: { silent: true },
  });

  useEffect(() => {
    if (!query.data || query.isPlaceholderData) return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(query.data));
    } catch {
      /* storage unavailable */
    }
    if (query.data.countryCode) setDetectedCountry(query.data.countryCode);
  }, [query.data, query.isPlaceholderData, setDetectedCountry]);

  return query.data ?? null;
}

/**
 * Best approximate map centre when there is no fresh GPS fix:
 * device-based place → the profile city → IP guess (can be kilometres off, last resort).
 */
export function fallbackCenter(place: Place | null, profileCenter?: LatLng | null): LatLng | null {
  if (place?.precise) return place.center;
  return profileCenter ?? place?.center ?? null;
}
