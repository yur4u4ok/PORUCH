import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";

import { usersApi, type SupportTopic } from "@/api/users";
import { PageHeader } from "@/components/layout/AppLayout";
import { Button, Card, Select, Textarea } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { toast } from "@/stores/toastStore";

const TOPICS: SupportTopic[] = ["QUESTION", "BUG", "IDEA", "SAFETY", "OTHER"];
const MAX = 3000;

/** Write to the Poruch team. Sent by email; the reply comes to the user's own address. */
export default function SupportPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const from = (useLocation().state as { from?: string } | null)?.from ?? "";
  const [topic, setTopic] = useState<SupportTopic>("QUESTION");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: () => usersApi.support({ topic, message: message.trim(), page: from }),
    onSuccess: () => {
      setSent(true);
      setMessage("");
      toast.success(t("support.sent"));
    },
  });

  return (
    <main className="page stack">
      <PageHeader title={t("support.title")} />
      {sent ? (
        <Card className="stack-sm">
          <strong>✅ {t("support.sent")}</strong>
          <p className="muted">{t("support.replyNote", { email: me?.email ?? "" })}</p>
          <Button variant="secondary" onClick={() => setSent(false)}>
            {t("support.another")}
          </Button>
        </Card>
      ) : (
        <Card className="stack-sm">
          <p className="muted">{t("support.intro")}</p>
          <Select
            label={t("support.topic")}
            value={topic}
            onChange={(e) => setTopic(e.target.value as SupportTopic)}
          >
            {TOPICS.map((code) => (
              <option key={code} value={code}>
                {t(`support.topics.${code}`)}
              </option>
            ))}
          </Select>
          <Textarea
            label={t("support.message")}
            placeholder={t("support.placeholder")}
            rows={6}
            maxLength={MAX}
            showCounter
            valueLength={message.length}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="muted" style={{ fontSize: 13 }}>
            {t("support.replyNote", { email: me?.email ?? "" })}
          </p>
          <Button onClick={() => send.mutate()} disabled={!message.trim() || send.isPending}>
            {send.isPending ? t("create.submitting") : t("support.send")}
          </Button>
        </Card>
      )}
    </main>
  );
}
