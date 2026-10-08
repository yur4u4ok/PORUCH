import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { queryKeys } from "@/api/queryKeys";

import { playChime, soundEnabled } from "./sound";

const FAVICON = "/icons/favicon.svg";

/** Favicon with a red dot (canvas over the normal icon); restores the plain icon at 0. */
function setFaviconDot(on: boolean) {
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  if (!on) {
    link.href = FAVICON;
    return;
  }
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, 64, 64);
    ctx.beginPath();
    ctx.arc(50, 14, 13, 0, Math.PI * 2);
    ctx.fillStyle = "#e5484d";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    link.href = canvas.toDataURL("image/png");
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
