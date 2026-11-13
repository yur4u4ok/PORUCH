import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import styles from "./InfoTip.module.css";

/**
 * A small round «i». Hover (or keyboard focus) shows the text; on touch screens a tap toggles it,
 * and a tap anywhere else closes it.
 */
export function InfoTip({
  text,
  label,
  icon,
  className,
}: {
  text: React.ReactNode;
  /** Accessible name of an icon tip (the text may hold more than one line). */
  label?: string;
  /** Shown instead of the «i» (then the button is just the icon, no circle). */
  icon?: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <span ref={ref} className={styles.wrap} data-open={open || undefined}>
      <button
        type="button"
        className={icon ? `${styles.plain} ${className ?? ""}` : styles.button}
        aria-label={icon ? label : t("common.moreInfo")}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon ?? "i"}
      </button>
      <span id={id} role="tooltip" className={styles.tip}>
        {text}
      </span>
    </span>
  );
}
