/**
 * MapLibre wrapper. Tile provider is configured by VITE_MAP_STYLE_URL (any MapLibre style JSON),
 * so the app is not tied to a specific provider.
 */
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
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

export function MapView({
  center,
  zoom = 13,
  height = 320,
  markers = [],
  me,
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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !picker) {
      pickerRef.current?.remove();
      pickerRef.current = null;
      return;
    }
    if (!pickerRef.current) {
      const marker = new Marker({ draggable: true, color: "#3b2a20" })
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
