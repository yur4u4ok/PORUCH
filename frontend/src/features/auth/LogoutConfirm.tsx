import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { ConfirmDialog } from "@/features/help/components";

import { useLogout } from "./hooks";

/** «Вийти» always asks first. Returns a function to open the question and the dialog to render. */
export function useLogoutConfirm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const dialog = (
    <ConfirmDialog
      open={open}
      onClose={() => setOpen(false)}
      title={t("auth.logoutTitle")}
      text={t("auth.logoutText")}
      confirmLabel={t("auth.logout")}
      danger
      loading={logout.isPending}
      onConfirm={() =>
        logout.mutate(undefined, {
          onSettled: () => {
            setOpen(false);
            navigate("/", { replace: true });
          },
        })
      }
    />
  );
  return { ask: () => setOpen(true), dialog };
}
