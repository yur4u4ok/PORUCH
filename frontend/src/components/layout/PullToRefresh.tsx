import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./PullToRefresh.module.css";

const THRESHOLD = 70; // px of pull (after resistance) that triggers a refresh
const MAX = 110;

/** Something under the finger scrolls on its own (chat list, map…): let it handle the gesture. */
function handledByInner(target: EventTarget | null): boolean {
  for (let el = target as HTMLElement | null; el && el !== document.body; el = el.parentElement) {
    if (el.closest(".maplibregl-map")) return true;
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight && el.scrollTop > 0)
      return true;
  }
  return false;
}

/**
 * Pull down at the top of the page to reload data. Installed PWAs (standalone) have no browser
 * pull-to-refresh, so this provides it; data is refetched instead of reloading the whole app.
 */
export function PullToRefresh() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (refreshing || window.scrollY > 0 || e.touches.length !== 1 || handledByInner(e.target)) return;
      start.current = e.touches[0]!.clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0]!.clientY - start.current;
      if (dy <= 0 || window.scrollY > 0) {
        start.current = null;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      pullRef.current = Math.min(MAX, dy * 0.5); // resistance
      setPull(pullRef.current);
    };
    const onEnd = () => {
      if (start.current == null) return;
      start.current = null;
      const reached = pullRef.current >= THRESHOLD;
      pullRef.current = 0;
      setPull(0);
      if (!reached) return;
      setRefreshing(true);
      void qc.invalidateQueries().finally(() => setRefreshing(false));
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [qc, refreshing]);

  if (!pull && !refreshing) return null;
  const ready = pull >= THRESHOLD;
  return (
    <div
      className={styles.indicator}
      style={{ transform: `translate(-50%, ${refreshing ? 56 : pull - 40}px)` }}
      role="status"
      aria-label={refreshing ? t("common.loading") : undefined}
    >
      <span
        className={refreshing ? styles.spin : undefined}
        style={refreshing ? undefined : { transform: `rotate(${ready ? 180 : (pull / THRESHOLD) * 180}deg)` }}
        aria-hidden
      >
        {refreshing ? "↻" : "↓"}
      </span>
    </div>
  );
}
