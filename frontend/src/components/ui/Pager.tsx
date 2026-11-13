import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import styles from "./Pager.module.css";

/**
 * A list page plus page switcher. A shorter (last) page keeps the height of a full page,
 * so the switcher doesn't jump; full pages take exactly their own height.
 */
export function PagedBlock({
  page,
  pages,
  onPage,
  busy = false,
  children,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fullHeight, setFullHeight] = useState(0);
  // Every page but the last one is full.
  const full = page < pages;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || pages <= 1 || !full) return;
    const observer = new ResizeObserver(([entry]) => {
      setFullHeight(entry?.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pages, full]);
  return (
    <>
      <div
        ref={ref}
        className="stack-sm"
        style={{ minHeight: pages > 1 && !full ? fullHeight : undefined, opacity: busy ? 0.6 : 1 }}
        aria-busy={busy}
      >
        {children}
      </div>
      {pages > 1 && <Pager page={page} pages={pages} onPage={onPage} />}
    </>
  );
}

/** ‹ 1 2 … 7 › — current page, its neighbours, first and last. */
export function Pager({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const shown = Array.from({ length: pages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pages || Math.abs(p - page) <= 1,
  );
  return (
    <nav className={styles.pager} aria-label={t("pager.label")}>
      <button
        type="button"
        className={styles.step}
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        aria-label={t("pager.previous")}
      >
        ‹
      </button>
      {shown.map((p, i) => (
        <span key={p} className={styles.group}>
          {i > 0 && p - shown[i - 1]! > 1 && <span className={styles.gap}>…</span>}
          <button
            type="button"
            className={p === page ? styles.current : styles.num}
            aria-current={p === page ? "page" : undefined}
            onClick={() => onPage(p)}
          >
            {p}
          </button>
        </span>
      ))}
      <button
        type="button"
        className={styles.step}
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        aria-label={t("pager.next")}
      >
        ›
      </button>
    </nav>
  );
}
