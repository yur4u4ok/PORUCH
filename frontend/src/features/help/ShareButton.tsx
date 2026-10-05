import { useState } from "react";
import { useTranslation } from "react-i18next";

import { BottomSheet, Button } from "@/components/ui";
import { toast } from "@/stores/toastStore";

/**
 * Share a request link to messengers. Uses the system share sheet when available (phones),
 * otherwise copy + Telegram / Viber / WhatsApp buttons.
 */
export function ShareButton({ url, text }: { url: string; text: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const message = `${text}\n${url}`;

  const onShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch (error) {
        if ((error as Error).name === "AbortError") return; // user closed the sheet
      }
    }
    setOpen(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("share.copied"));
    } catch {
      window.prompt(t("share.copy"), url);
    }
  };

  const enc = encodeURIComponent;
  const targets = [
    { key: "telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { key: "viber", href: `viber://forward?text=${enc(message)}` },
    { key: "whatsapp", href: `https://wa.me/?text=${enc(message)}` },
  ];

  return (
    <>
      <Button variant="secondary" block onClick={() => void onShare()}>
        ↗ {t("share.button")}
      </Button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("share.title")}>
        <p className="muted">{t("share.why")}</p>
        <Button block onClick={() => void copy()}>
          🔗 {t("share.copy")}
        </Button>
        <div className="row wrap">
          {targets.map((target) => (
            <a key={target.key} href={target.href} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
              <Button variant="secondary" block>
                {t(`share.${target.key}`)}
              </Button>
            </a>
          ))}
        </div>
        <code style={{ wordBreak: "break-all", fontSize: 13 }}>{url}</code>
      </BottomSheet>
    </>
  );
}
