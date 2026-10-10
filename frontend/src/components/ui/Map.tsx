/**
 * MapLibre wrapper. Tile provider is configured by VITE_MAP_STYLE_URL (any MapLibre style JSON),
 * so the app is not tied to a specific provider.
 */
import {
  type GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { useEffect, useRef } from "react";

import type { LatLng } from "@/types/api";

import styles from "./Map.module.css";
import { MAP_STYLE_URL } from "./mapConfig";

// MapLibre resolves its worker relative to its own module, which breaks after bundling.
// Point it to the worker bundled by Vite instead.
setWorkerUrl(maplibreWorkerUrl);

export interface MapMarker {
  id: string;
  position: LatLng;
  color: string;
  label?: string;
  approximate?: boolean;
  title?: string;
}

interface MapProps {
  center: LatLng;
  zoom?: number;
  height?: number | string;
  markers?: MapMarker[];
  me?: LatLng | null;
  /** Uncertainty of `me`, metres: drawn as a translucent circle around it. */
  meAccuracy?: number | null;
  onMarkerClick?: (id: string) => void;
  /** Draggable picker marker (create request). */
  picker?: LatLng | null;
  onPickerChange?: (position: LatLng) => void;
  ariaLabel?: string;
  /** Zoom out/in so that all markers (and "me") are visible. */
  fitMarkers?: boolean;
}

function markerElement(marker: MapMarker, onClick?: (id: string) => void): HTMLElement {
  // The root element is positioned by MapLibre (inline transform) — style only the inner element.
  const el = document.createElement("button");
  el.type = "button";
  el.className = styles.markerRoot ?? "";
  el.title = marker.title ?? "";
  el.setAttribute("aria-label", marker.title ?? marker.label ?? "marker");
  const inner = document.createElement("span");
  const label = document.createElement("span");
  label.textContent = marker.label ?? "🆘";
  inner.appendChild(label);
  if (marker.approximate) {
    inner.className = styles.approx ?? "";
    inner.style.color = marker.color;
  } else {
    inner.className = styles.marker ?? "";
    inner.style.background = marker.color;
  }
  el.appendChild(inner);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick?.(marker.id);
  });
  return el;
}

const ACCURACY_SOURCE = "me-accuracy";
type PolygonFeature = {
  type: "Feature";
  properties: Record<string, never>;
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
};
const EMPTY = { type: "FeatureCollection" as const, features: [] as PolygonFeature[] };

/** A circle of `radius` metres around a point, as a 64-sided polygon. */
function circle(center: LatLng, radius: number): PolygonFeature {
  const points: [number, number][] = [];
  const latRad = (center.latitude * Math.PI) / 180;
  const dLat = radius / 111_320;
  const dLng = radius / (111_320 * Math.cos(latRad));
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    points.push([center.longitude + dLng * Math.cos(a), center.latitude + dLat * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [points] } };
}

export function MapView({
  center,
  zoom = 13,
  height = 320,
  markers = [],
  me,
  meAccuracy,
  onMarkerClick,
  picker,
  onPickerChange,
  ariaLabel,
  fitMarkers = false,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const meRef = useRef<Marker | null>(null);
  const pickerRef = useRef<Marker | null>(null);
  const onPickerChangeRef = useRef(onPickerChange);
  useEffect(() => {
    onPickerChangeRef.current = onPickerChange;
  }, [onPickerChange]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [center.longitude, center.latitude],
      zoom,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      // Markers belong to the destroyed map: drop the references so they are recreated on the new one.
      markersRef.current = [];
      meRef.current = null;
      pickerRef.current = null;
    };
    // map is created once; center updates handled below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.easeTo({ center: [center.longitude, center.latitude] });
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = markers.map((marker) =>
      new Marker({
        element: markerElement(marker, onMarkerClick),
        anchor: marker.approximate ? "center" : "bottom",
      })
        .setLngLat([marker.position.longitude, marker.position.latitude])
        .addTo(map),
    );
    if (fitMarkers && markers.length) {
      const bounds = new LngLatBounds();
      markers.forEach((m) => bounds.extend([m.position.longitude, m.position.latitude]));
      if (me) bounds.extend([me.longitude, me.latitude]);
      map.fitBounds(bounds, { padding: 56, maxZoom: 15, duration: 0 });
    }
    // `me` is intentionally not a dependency: refit only when the result set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, onMarkerClick, fitMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    meRef.current?.remove();
    meRef.current = null;
    if (!map || !me) return;
    const el = document.createElement("div");
    el.className = styles.me ?? "";
    meRef.current = new Marker({ element: el }).setLngLat([me.longitude, me.latitude]).addTo(map);
  }, [me]);

  // Accuracy circle: shows how far off «you are here» may be (a rough fix draws a big circle).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const radius = me && meAccuracy && meAccuracy > 0 ? meAccuracy : 0;
    const draw = () => {
      const data = radius && me ? circle(me, radius) : EMPTY;
      const source = map.getSource(ACCURACY_SOURCE) as GeoJSONSource | undefined;
      if (source) return source.setData(data);
      map.addSource(ACCURACY_SOURCE, { type: "geojson", data });
      map.addLayer({
        id: `${ACCURACY_SOURCE}-fill`,
        type: "fill",
        source: ACCURACY_SOURCE,
        paint: { "fill-color": "#2b7cff", "fill-opacity": 0.12 },
      });
      map.addLayer({
        id: `${ACCURACY_SOURCE}-line`,
        type: "line",
        source: ACCURACY_SOURCE,
        paint: { "line-color": "#2b7cff", "line-opacity": 0.5, "line-width": 1.5 },
      });
    };
    if (map.isStyleLoaded()) draw();
    else map.once("load", draw);
    // A wide circle (rough fix) is only useful if it is visible as a whole: zoom out to it.
    if (me && radius > 150) {
      const ring = circle(me, radius).geometry.coordinates[0]!;
      const bounds = ring.reduce((b, point) => b.extend(point), new LngLatBounds());
      map.fitBounds(bounds, { padding: 24, maxZoom: 16, duration: 0 });
    }
  }, [me, meAccuracy]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !picker) {
      pickerRef.current?.remove();
      pickerRef.current = null;
      return;
    }
    if (!pickerRef.current) {
      const marker = new Marker({ draggable: true, color: "#15803d" })
        .setLngLat([picker.longitude, picker.latitude])
        .addTo(map);
      marker.on("dragend", () => {
        const { lng, lat } = marker.getLngLat();
        onPickerChangeRef.current?.({ latitude: lat, longitude: lng });
      });
      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        onPickerChangeRef.current?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
      });
      pickerRef.current = marker;
    } else {
      pickerRef.current.setLngLat([picker.longitude, picker.latitude]);
    }
  }, [picker]);

  return (
    <div className={styles.wrap} style={{ height }} role="region" aria-label={ariaLabel}>
      <div ref={containerRef} className={styles.map} />
    </div>
  );
}
