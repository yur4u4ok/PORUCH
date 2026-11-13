import clsx from "clsx";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { currentLocale, LANGUAGES, setLocale, type Locale } from "@/i18n";

import styles from "./LanguageSwitcher.module.css";

/**
 * Language picker: a themed list instead of the browser's own drop-down. Names are in their own
 * language, so anyone can find theirs. `compact` is the pill for the signed-out pages; the full one
 * is a field-width control for settings.
 */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const value = i18n.language ? currentLocale() : "en";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const current = LANGUAGES.find((l) => l.code === value);

  // close on a tap outside or when focus leaves the picker
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  // keep the highlighted language in view while moving with the keyboard
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const show = () => {
    setActive(
      Math.max(
        0,
        LANGUAGES.findIndex((l) => l.code === value),
      ),
    );
    setOpen(true);
  };
  const choose = (code: Locale) => {
    setOpen(false);
    if (code !== value) void setLocale(code);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(LANGUAGES.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActive(e.key === "Home" ? 0 : LANGUAGES.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const pick = LANGUAGES[active];
      if (pick) choose(pick.code as Locale);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div ref={root} className={clsx(styles.picker, !compact && styles.full)}>
      <button
        type="button"
        className={compact ? styles.compact : styles.field}
        aria-label={`${t("settings.language")}: ${current?.name ?? value}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        {compact && (
          <svg className={styles.globe} width="16" height="16" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" />
          </svg>
        )}
        <span className={styles.current}>{current?.name ?? value}</span>
        <svg
          className={clsx(styles.chevron, open && styles.chevronOpen)}
          width="12"
          height="8"
          viewBox="0 0 12 8"
          aria-hidden
        >
          <path d="M1 1.5l5 5 5-5" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={t("settings.language")}
          aria-activedescendant={`${listId}-${active}`}
          className={styles.menu}
        >
          {LANGUAGES.map((l, i) => (
            <li
              key={l.code}
              id={`${listId}-${i}`}
              role="option"
              lang={l.code}
              aria-selected={l.code === value}
              className={clsx(styles.option, i === active && styles.active)}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(l.code as Locale)}
            >
              {l.name}
              {l.code === value && (
                <svg className={styles.check} width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
