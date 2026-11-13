import { useTranslation } from "react-i18next";

import styles from "./SelectAll.module.css";

/** «Обрано 3 з 7 · Вибрати все» above a list of chips: a quiet counter and a text toggle. */
export function SelectAll<T extends string>({
  all,
  selected,
  onChange,
}: {
  all: readonly T[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
}) {
  const { t } = useTranslation();
  const count = all.filter((item) => selected.includes(item)).length;
  const everything = all.length > 0 && count === all.length;
  return (
    <div className={styles.bar}>
      <span className={styles.count}>{t("common.selectedOf", { count, total: all.length })}</span>
      <button type="button" className={styles.toggle} onClick={() => onChange(everything ? [] : [...all])}>
        {everything ? t("common.selectNone") : t("common.selectAll")}
      </button>
    </div>
  );
}
