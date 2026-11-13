import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import { Button, Card, Modal } from "@/components/ui";
import { toast } from "@/stores/toastStore";

import styles from "./InstallPrompt.module.css";
import {
  dismissedRecently,
  promptInstall,
  rememberDismissed,
  useInstallState,
  type Platform,
} from "./install";

/** Small inline glyphs of the Safari menu items the steps mention. */
const glyph = (path: React.ReactNode) => (
  <svg
    className={styles.glyph}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    {path}
  </svg>
);
const STEP_ICONS = {
  share: glyph(
    <>
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M6 11v9h12v-9" />
    </>,
  ),
  dots: glyph(
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </>,
  ),
  more: glyph(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 10.5l4 4 4-4" />
    </>,
  ),
  install: glyph(
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 7v6M9.5 10.5 12 13l2.5-2.5" />
    </>,
  ),
  add: glyph(
    <>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>,
  ),
};

/** Short steps where the browser cannot install on a button press. */
function Steps({ platform }: { platform: Platform }) {
  const { t } = useTranslation();
  const steps = t(`install.steps.${platform}`, { returnObjects: true }) as string[];
  return (
    <ol className={styles.steps}>
      {steps.map((step, i) => (
        <li key={step}>
          <Trans i18nKey={`install.steps.${platform}.${i}`} components={STEP_ICONS} />
        </li>
      ))}
    </ol>
  );
}

/** Install dialog content: native install button when possible, otherwise instructions. */
function InstallBody({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { canPrompt, platform } = useInstallState();
  const install = async () => {
    if (await promptInstall()) {
      toast.success(t("install.thanks"));
      onDone();
    }
  };
  return (
    <div className="stack-sm">
      {canPrompt ? (
        <Button size="lg" block onClick={() => void install()}>
          📲 {t("install.button")}
        </Button>
      ) : (
        <Steps platform={platform} />
      )}
    </div>
  );
}

/** Shown automatically a few seconds after opening the app in a browser (not when installed). */
export function InstallPrompt() {
  const { t } = useTranslation();
  const { standalone } = useInstallState();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (standalone || dismissedRecently()) return;
    const timer = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(timer);
  }, [standalone]);

  const later = () => {
    rememberDismissed();
    setOpen(false);
  };
  return (
    <Modal
      open={open && !standalone}
      onClose={later}
      title={`📲 ${t("install.title")}`}
      actions={
        <Button variant="secondary" onClick={later}>
          {t("install.later")}
        </Button>
      }
    >
      <InstallBody onDone={() => setOpen(false)} />
    </Modal>
  );
}

/** A persistent, quieter entry point (home screen and settings) until the app is installed. */
export function InstallCard() {
  const { t } = useTranslation();
  const { standalone } = useInstallState();
  const [open, setOpen] = useState(false);
  if (standalone) return null;
  return (
    <>
      <Card className={styles.card}>
        <span className={styles.icon} aria-hidden>
          📲
        </span>
        <span className="stack-sm" style={{ gap: 2 }}>
          <strong>{t("install.cardTitle")}</strong>
          <small className="muted">{t("install.cardText")}</small>
        </span>
        <Button size="sm" onClick={() => setOpen(true)}>
          {t("install.cardButton")}
        </Button>
      </Card>
      <Modal open={open} onClose={() => setOpen(false)} title={`📲 ${t("install.title")}`}>
        <InstallBody onDone={() => setOpen(false)} />
      </Modal>
    </>
  );
}
