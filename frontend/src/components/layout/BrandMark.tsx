import clsx from "clsx";
import { useTranslation } from "react-i18next";

import { BRAND } from "@/app/brand";

import styles from "./BrandMark.module.css";

/** Logo + "Poruch" + the slogan under it. The name never changes; the slogan is translated. */
export function BrandMark({
  inverse = false,
  size = "md",
  className,
}: {
  inverse?: boolean;
  size?: "md" | "lg";
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span className={clsx(styles.mark, styles[size], inverse && styles.inverse, className)}>
      <img src={inverse ? "/icons/logo-inverse.svg" : "/icons/favicon.svg"} alt="" />
      <span className={styles.words}>
        <span className={styles.name}>{BRAND}</span>
        <span className={styles.slogan}>{t("app.slogan")}</span>
      </span>
    </span>
  );
}
