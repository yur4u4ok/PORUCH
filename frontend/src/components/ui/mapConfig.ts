/** Tile provider is configurable (any MapLibre style JSON URL); default is an OSM-based style. */
export const MAP_STYLE_URL: string =
  import.meta.env.VITE_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";
