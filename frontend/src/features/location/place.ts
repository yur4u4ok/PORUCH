import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useRegionStore } from "@/i18n/region";
import { useLocationStore } from "@/stores/locationStore";
import type { LatLng } from "@/types/api";

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
  const setDetectedCountry = useRegionStore((s) => s.setDetectedCountry);
  // City comes from the map's own fix when there is one, otherwise from the IP address.
  // Never request a separate low-accuracy fix: browsers cache it and hand it to the map later.
  const position = mapPosition;

  const cell = position ? [round(position.latitude), round(position.longitude)] : null;
  const query = useQuery({
    queryKey: ["place", i18n.language, cell],
    // Only the rounded cell goes to the geocoder; the map keeps the exact position (see below).
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

  const place = query.data ?? null;
  // Only a real map fix counts as precise; a coarse or cached fix must never centre a map.
  if (place?.precise && mapPosition) return { ...place, center: mapPosition };
  return place?.precise ? { ...place, precise: false } : place;
}

/**
 * Map centre when there is no GPS fix: an exact device position or the profile city.
 * The IP-based guess is never used on a map — it is kilometres off and looks like "your" location.
 */
export function fallbackCenter(place: Place | null, profileCenter?: LatLng | null): LatLng | null {
  if (place?.precise) return place.center;
  return profileCenter ?? null;
}
