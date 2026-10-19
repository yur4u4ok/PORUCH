import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { usersApi } from "@/api/users";
import { useMe } from "@/features/auth/hooks";

/**
 * Keeps the account's language equal to the interface language, so push notifications and emails
 * (written on the server, later) arrive in the language the person reads the app in.
 */
export function LanguageSync() {
  const { i18n } = useTranslation();
  const { data: me } = useMe();
  const current = i18n.language;
  const saved = me?.language;
  useEffect(() => {
    // The server stores Chinese as «zh-hans»: compare the base language only.
    if (!saved || saved.split("-")[0] === current.split("-")[0]) return;
    void usersApi.updateMe({ language: current }).catch(() => undefined);
  }, [saved, current]);
  return null;
}
