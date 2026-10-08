import { useId } from "react";
import { useTranslation } from "react-i18next";

import styles from "./Stepper.module.css";

/** − value + for small counts (e.g. how many people are needed). */
export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={styles.field}>
      <span id={id} className={styles.label}>
        {label}
      </span>
      <div className={styles.row} role="group" aria-labelledby={id}>
        <button
          type="button"
          className={styles.button}
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={t("common.less")}
        >
          −
        </button>
        <output className={styles.value} aria-live="polite">
          {value}
        </output>
        <button
          type="button"
          className={styles.button}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={t("common.more")}
        >
          +
        </button>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}
