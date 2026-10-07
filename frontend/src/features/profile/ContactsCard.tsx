import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/api/client";
import { Button, Card, Input, Modal } from "@/components/ui";
import { toast } from "@/stores/toastStore";
import type { Me } from "@/types/api";
import { region } from "@/utils/format";

import { useChangeEmail, useUpdateMe } from "./hooks";

const errorOf = (error: unknown, field: string) =>
  error instanceof ApiError
    ? (error.fieldErrors()[field] ?? (error.code === "EMAIL_TAKEN" ? error.message : undefined))
    : undefined;

function PhoneDialog({ me, onClose }: { me: Me; onClose: () => void }) {
  const { t } = useTranslation();
  const update = useUpdateMe();
  const [phone, setPhone] = useState(me.phone ?? "");
  const save = () =>
    update.mutate(
      { phone: phone.trim(), phone_region: region().country },
      {
        onSuccess: () => {
          toast.success(t("profile.phoneSaved"));
          onClose();
        },
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={t("profile.changePhone")}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} loading={update.isPending}>
            {t("common.save")}
          </Button>
        </>
      }
    >
      <Input
        label={t("auth.phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        autoFocus
        placeholder="+380 67 123 45 67"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        hint={t("auth.phoneHint")}
        error={errorOf(update.error, "phone")}
      />
    </Modal>
  );
}

function EmailDialog({ me, onClose }: { me: Me; onClose: () => void }) {
  const { t } = useTranslation();
  const change = useChangeEmail();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const save = () =>
    change.mutate(
      { email: email.trim(), password: me.has_password ? password : undefined },
      {
        onSuccess: () => {
          toast.success(t("profile.emailSent", { email: email.trim() }));
          onClose();
        },
      },
    );
  return (
    <Modal
      open
      onClose={onClose}
      title={t("profile.changeEmail")}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} loading={change.isPending} disabled={!email.trim()}>
            {t("profile.sendConfirmation")}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">{t("profile.changeEmailText")}</p>
        <Input
          label={t("profile.newEmail")}
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errorOf(change.error, "email")}
        />
        {me.has_password && (
          <Input
            label={t("auth.password")}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errorOf(change.error, "password")}
          />
        )}
      </div>
    </Modal>
  );
}

/** Email and phone in the profile. Others see them only after this user and they agree on help. */
export function ContactsCard({ me }: { me: Me }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<"email" | "phone" | null>(null);
  return (
    <Card className="stack-sm">
      <strong>{t("profile.contacts")}</strong>
      <div className="row-between">
        <span style={{ overflowWrap: "anywhere" }}>📧 {me.email}</span>
        <Button variant="ghost" size="sm" onClick={() => setEditing("email")}>
          {t("profile.change")}
        </Button>
      </div>
      {me.pending_email && (
        <span className="muted" style={{ fontSize: 13 }}>
          ⏳ {t("profile.emailPending", { email: me.pending_email })}
        </span>
      )}
      <div className="row-between">
        <span>📞 {me.phone ?? <span className="muted">{t("profile.noPhone")}</span>}</span>
        <Button variant="ghost" size="sm" onClick={() => setEditing("phone")}>
          {me.phone ? t("profile.change") : t("profile.addPhone")}
        </Button>
      </div>
      <span className="muted" style={{ fontSize: 13 }}>
        🔒 {t("profile.contactsPrivacy")}
      </span>
      {editing === "email" && <EmailDialog me={me} onClose={() => setEditing(null)} />}
      {editing === "phone" && <PhoneDialog me={me} onClose={() => setEditing(null)} />}
    </Card>
  );
}
