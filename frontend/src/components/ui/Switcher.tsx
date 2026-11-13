import clsx from "clsx";
import { useId } from "react";

import styles from "./Switcher.module.css";

export interface SwitcherOption<T extends string> {
  value: T;
  label: string;
  /** Shown as a small badge; 0 is shown too (muted) so every option reads the same. */
  count?: number;
}

/**
 * Compact pill switch between a few lists (sized to its labels, not stretched across the screen).
 * Render the chosen list inside `children` — it becomes the tab panel.
 */
export function Switcher<T extends string>({
  options,
  value,
  onChange,
  label,
  children,
}: {
  options: SwitcherOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  children?: React.ReactNode;
}) {
  const id = useId();
  return (
    <>
      <div className={styles.switch} role="tablist" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`${id}-${option.value}`}
            aria-selected={value === option.value}
            aria-controls={`${id}-panel`}
            className={clsx(styles.item, value === option.value && styles.active)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
            {option.count !== undefined && (
              <span className={clsx(styles.count, option.count === 0 && styles.zero)}>{option.count}</span>
            )}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`} className="stack-sm">
        {children}
      </div>
    </>
  );
}
