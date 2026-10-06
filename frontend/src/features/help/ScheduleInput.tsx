import { useId } from "react";
import { useTranslation } from "react-i18next";

import { formatTime } from "@/utils/format";

import styles from "./ScheduleInput.module.css";

const SLOT_MINUTES = 15;
const pad = (n: number) => String(n).padStart(2, "0");
/** "HH:mm" every 15 minutes. */
const SLOTS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => {
  const minutes = i * SLOT_MINUTES;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

/**
 * Date + time for "at a specific time". The native datetime-local picker shows the time in the
 * browser's own locale (often 12-hour AM/PM regardless of the app language), so the time is our
 * own list, labelled in the user's regional format (24-hour in Ukraine, AM/PM in the US…).
 * Value: "YYYY-MM-DDTHH:mm" in local time, or "" while incomplete.
 */
export function ScheduleInput({
  value,
  onChange,
  minDate,
  maxDate,
  label,
  hint,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  minDate: string;
  maxDate: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [date = "", time = ""] = value ? value.split("T") : [];
  const emit = (nextDate: string, nextTime: string) =>
    onChange(nextDate && nextTime ? `${nextDate}T${nextTime}` : "");
  // Picking a date first suggests 10:00; the time list stays changeable.
  const setDate = (d: string) => emit(d, time || "10:00");
  const setTime = (tm: string) => emit(date, tm);

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={`${id}-date`}>
        {label}
      </label>
      <div className={styles.row}>
        <input
          id={`${id}-date`}
          type="date"
          className={styles.control}
          value={date}
          min={minDate}
          max={maxDate}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={!!error || undefined}
        />
        <select
          aria-label={t("create.neededAtTime")}
          className={styles.control}
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={!date}
        >
          {!time && (
            <option value="" disabled>
              --:--
            </option>
          )}
          {SLOTS.map((slot) => {
            const [h, m] = slot.split(":").map(Number);
            return (
              <option key={slot} value={slot}>
                {formatTime(new Date(2000, 0, 1, h, m))}
              </option>
            );
          })}
        </select>
      </div>
      {error ? (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : (
        hint && <p className={styles.hint}>{hint}</p>
      )}
    </div>
  );
}
