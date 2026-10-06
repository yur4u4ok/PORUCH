import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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

/** Step-by-step instructions where the browser cannot install on a button press. */
function Steps({ platform }: { platform: Platform }) {
  const { t } = useTranslation();
  const steps = t(`install.steps.${platform}`, { returnObjects: true }) as string[];
  return (
    <ol className={styles.steps}>
      {steps.map((step) => (
        <li key={step}>{step}</li>
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
      <p>{t("install.why")}</p>
      <ul className={styles.benefits}>
        {(t("install.benefits", { returnObjects: true }) as string[]).map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      {canPrompt ? (
        <Button size="lg" block onClick={() => void install()}>
          📲 {t("install.button")}
        </Button>
      ) : (
        <>
          <strong>{t("install.howTo")}</strong>
          <Steps platform={platform} />
        </>
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
