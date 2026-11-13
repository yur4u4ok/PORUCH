import { useTranslation } from "react-i18next";

import type { GeoPosition } from "@/types/api";

import styles from "./RoughLocationHint.module.css";

/** Above this the device clearly isn't using GPS (Wi-Fi/cell guess or «approximate location» mode). */
export const ROUGH_ACCURACY_M = 100;

/** Says plainly when «you are here» may be far off, and what to do about it. */
export function RoughLocationHint({
  position,
  canDrag = false,
}: {
  position: GeoPosition | null;
  canDrag?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const accuracy = position?.accuracy;
  if (!accuracy || accuracy <= ROUGH_ACCURACY_M) return null;
  const km = accuracy >= 1000;
  const metres = new Intl.NumberFormat(i18n.language, {
    style: "unit",
    unit: km ? "kilometer" : "meter",
    maximumFractionDigits: km ? 1 : 0,
  }).format(km ? accuracy / 1000 : accuracy);
  return (
    <p role="status" className={styles.hint}>
      🎯 {t(canDrag ? "location.roughDrag" : "location.rough", { metres })}
    </p>
  );
}
