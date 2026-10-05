import type { City } from "@/types/api";

/** City names are data: use the translation for the current language, fall back to the default name. */
export function cityName(city: Pick<City, "name" | "translations">, language: string): string {
  return city.translations?.[language] || city.name;
}
