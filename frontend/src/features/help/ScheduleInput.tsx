import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { de, enUS, es, fr, hi, it, ja, ko, pl, pt, tr, uk, zhCN } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { useTranslation } from "react-i18next";

import { formatDate, formatTime } from "@/utils/format";

import styles from "./ScheduleInput.module.css";

const SLOT_MINUTES = 15;
const pad = (n: number) => String(n).padStart(2, "0");
/** "HH:mm" every 15 minutes. */
const SLOTS = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => {
  const minutes = i * SLOT_MINUTES;
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
});

const DAY_LOCALES = { uk, en: enUS, de, es, fr, hi, it, ja, ko, pl, pt, tr, zh: zhCN };

/** Open/close state for a small drop-down: closes on a tap outside and on Esc. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return { open, setOpen, ref };
}

/** "YYYY-MM-DD" <-> local Date. */
const toDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d);
};
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Date as a button opening a month calendar in the app's look (not the browser's own picker). */
function DateField({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min: string;
  max: string;
  invalid: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { open, setOpen, ref } = usePopover();
  const locale = DAY_LOCALES[i18n.language.slice(0, 2) as keyof typeof DAY_LOCALES] ?? enUS;
  const selected = value ? toDate(value) : undefined;
  return (
    <div ref={ref} className={styles.timeWrap}>
      <button
        id={id}
        type="button"
        className={`${styles.control} ${styles.dateButton}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{selected ? formatDate(selected) : t("create.pickDate")}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
      {open && (
        <div className={styles.calendar} role="dialog">
          <DayPicker
            mode="single"
            locale={locale}
            selected={selected}
            defaultMonth={selected ?? toDate(min)}
            startMonth={toDate(min)}
            endMonth={toDate(max)}
            disabled={[{ before: toDate(min) }, { after: toDate(max) }]}
            onSelect={(day) => {
              if (day) onChange(toIso(day));
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Time as our own drop-down list: the native <select> with 96 options opened over itself on some
 * desktops and closed as soon as the mouse button was released.
 */
function TimeList({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  label: string;
}) {
  const { open, setOpen, ref } = usePopover();
  const listRef = useRef<HTMLDivElement>(null);
  const show = (slot: string) => {
    const [h, m] = slot.split(":").map(Number);
    return formatTime(new Date(2000, 0, 1, h, m));
  };
  useEffect(() => {
    if (!open) return;
    // scroll only the list (not the page) to the chosen time
    const list = listRef.current;
    const chosen = list?.querySelector<HTMLElement>("[aria-selected=true]");
    if (list && chosen) list.scrollTop = chosen.offsetTop - list.clientHeight / 2;
  }, [open]);
  return (
    <div ref={ref} className={styles.timeWrap}>
      <button
        type="button"
        className={styles.control}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {value ? show(value) : "--:--"}
      </button>
      {open && (
        <div ref={listRef} className={styles.timeList} role="listbox" aria-label={label}>
          {SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              role="option"
              aria-selected={slot === value}
              className={styles.timeOption}
              onClick={() => {
                onChange(slot);
                setOpen(false);
              }}
            >
              {show(slot)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
        <DateField
          id={`${id}-date`}
          value={date}
          onChange={setDate}
          min={minDate}
          max={maxDate}
          invalid={!!error}
        />
        <TimeList value={time} onChange={setTime} disabled={!date} label={t("create.neededAtTime")} />
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
