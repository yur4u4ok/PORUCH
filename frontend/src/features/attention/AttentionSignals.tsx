import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { queryKeys } from "@/api/queryKeys";

import { playChime, soundEnabled } from "./sound";

const FAVICON = "/icons/tab.svg"; // tightly cropped so the pin fills the tab

/**
 * Favicon with a red dot (canvas over the normal icon); restores the plain icons at 0.
 * The page declares several icons (.ico, PNGs, SVG) and the browser picks one of them, so all of
 * them are swapped — changing only the first left the dot invisible.
 */
const originals = new Map<HTMLLinkElement, { href: string; type: string }>();
let dotted: string | null = null;

function iconLinks(): HTMLLinkElement[] {
  return Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
}

function setFaviconDot(on: boolean) {
  const links = iconLinks();
  for (const link of links) {
    if (!originals.has(link)) originals.set(link, { href: link.getAttribute("href") ?? "", type: link.type });
  }
  if (!on) {
    for (const link of links) {
      const original = originals.get(link);
      if (!original) continue;
      link.href = original.href;
      link.type = original.type;
      link.removeAttribute("data-dot");
    }
    return;
  }
  const apply = (url: string) => {
    for (const link of iconLinks()) {
      link.href = url;
      link.type = "image/png";
      link.setAttribute("data-dot", "1");
    }
  };
  if (dotted) return apply(dotted);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 64, 64);
    ctx.beginPath();
    ctx.arc(48, 16, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#e5484d";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    dotted = canvas.toDataURL("image/png");
    apply(dotted);
  };
  img.src = FAVICON;
}

/**
 * Signals that something new arrived: refreshes counters on push messages from the service worker,
 * plays a short chime when the unread total grows while the page is visible, and shows a red dot
 * on the browser tab / a badge on the installed app icon.
 */
export function AttentionSignals({ unread }: { unread: number }) {
  const qc = useQueryClient();
  const previous = useRef<number | null>(null);
  const baseTitle = useRef(document.title);

  // Push arrived (app open or in the background tab): refresh what depends on it.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "poruch:push") return;
      void qc.invalidateQueries({ queryKey: queryKeys.unread });
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [qc]);

  useEffect(() => {
    if (previous.current !== null && unread > previous.current && soundEnabled()) playChime();
    previous.current = unread;

    setFaviconDot(unread > 0);
    const title = document.title.replace(/^\(\d+\)\s/, "");
    baseTitle.current = title;
    document.title = unread > 0 ? `(${unread}) ${title}` : title;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (unread > 0) void nav.setAppBadge?.(unread).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  }, [unread]);

  useEffect(
    () => () => {
      setFaviconDot(false);
      document.title = baseTitle.current;
    },
    [],
  );
  return null;
}
