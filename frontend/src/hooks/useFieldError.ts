import { useTranslation } from "react-i18next";

/** Translate a validation message stored as an i18n key ("key" or "key|max"); server messages pass through. */
export function useFieldError() {
  const { t } = useTranslation();
  return (message?: string): string | undefined => {
    if (!message) return undefined;
    const [key, max] = message.split("|");
    return t(key!, max ? { max: Number(max) } : undefined);
  };
}
