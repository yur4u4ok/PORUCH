import type { TFunction } from "i18next";

import type { Urgency } from "@/types/api";
import { formatDate, formatDateTime } from "@/utils/format";

/**
 * «Сьогодні» means the day it was posted: a TODAY request still open the next day reads «Вчора»,
 * older ones show the date.
 */
export function urgencyText(
  t: TFunction,
  urgency: Urgency,
  neededAt?: string | null,
  createdAt?: string | null,
): string {
  if (urgency === "SCHEDULED" && neededAt) return formatDateTime(neededAt);
  if (urgency === "TODAY" && createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    if (created.toDateString() === now.toDateString()) return t("urgency.TODAY");
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return created.toDateString() === yesterday.toDateString() ? t("when.yesterday") : formatDate(created);
  }
  return t(`urgency.${urgency}`);
}
