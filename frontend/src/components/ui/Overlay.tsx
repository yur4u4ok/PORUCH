import clsx from "clsx";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { IconButton } from "./Button";
import styles from "./Overlay.module.css";

function useOverlayBehaviour(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep the latest onClose without re-running the open effect: callers often pass inline
  // arrows, and re-running would steal focus from inputs on every keystroke.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Focus the dialog once on open (unless a field inside already took focus, e.g. autoFocus).
    if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      previous?.focus?.();
    };
  }, [open]);
  return panelRef;
}

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  dismissible?: boolean;
}

export function Modal({ open, onClose, title, children, actions, dismissible = true }: OverlayProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const panelRef = useOverlayBehaviour(open, dismissible ? onClose : () => undefined);
  if (!open) return null;
  return createPortal(
    <div className={styles.backdrop} onClick={dismissible ? onClose : undefined}>
      <div
        ref={panelRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={styles.header}>
            <h2 id={titleId}>{title}</h2>
            {dismissible && (
              <IconButton label={t("common.close")} onClick={onClose}>
                ✕
              </IconButton>
            )}
          </div>
        )}
        {children}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function BottomSheet({ open, onClose, title, children, actions }: OverlayProps) {
  const titleId = useId();
  const panelRef = useOverlayBehaviour(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className={clsx(styles.backdrop, styles.sheetBackdrop)} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <span className={styles.handle} aria-hidden />
        {title && <h2 id={titleId}>{title}</h2>}
        {children}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}
