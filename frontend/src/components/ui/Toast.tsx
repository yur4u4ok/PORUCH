import clsx from "clsx";
import { useTranslation } from "react-i18next";

import { useToastStore } from "@/stores/toastStore";

import styles from "./Overlay.module.css";

export function Toaster() {
  const { t } = useTranslation();
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className={styles.toasts} aria-live="polite" role="status">
      {toasts.map((item) => (
        <div
          key={item.id}
          className={clsx(styles.toast, item.tone !== "info" && styles[`toast-${item.tone}`])}
        >
          <span>{item.message}</span>
          <button
            className={styles.toastClose}
            aria-label={t("common.close")}
            onClick={() => dismiss(item.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
