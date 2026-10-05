import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui";

/** Registers the service worker and offers a reload when a new version is ready. */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const [update, setUpdate] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.MODE === "test") return;
    void import("virtual:pwa-register").then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh: () => setUpdate(() => () => updateSW(true)),
      });
    });
  }, []);

  if (!update) return null;
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        background: "var(--color-surface)",
        boxShadow: "var(--shadow-md)",
        borderRadius: 14,
        padding: "8px 12px",
        display: "flex",
        gap: 12,
        alignItems: "center",
      }}
    >
      {t("app.updateReady")}
      <Button size="sm" onClick={() => void update()}>
        {t("app.reload")}
      </Button>
    </div>
  );
}
