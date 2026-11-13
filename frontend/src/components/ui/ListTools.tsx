import { useTranslation } from "react-i18next";

import type { ListSort } from "@/api/helpRequests";
import type { useListFilter } from "@/hooks/useListFilter";

import styles from "./ListTools.module.css";

/** Search field plus a compact sort select, on one row. */
export function ListTools({
  filter,
  sorts,
}: {
  filter: ReturnType<typeof useListFilter>;
  sorts: ListSort[];
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.tools}>
      <SearchField value={filter.text} onChange={filter.setText} />
      <select
        className={styles.sort}
        value={filter.sort}
        onChange={(e) => filter.setSort(e.target.value as ListSort)}
        aria-label={t("listTools.sort")}
      >
        {sorts.map((s) => (
          <option key={s} value={s}>
            {t(`listTools.sorts.${s}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Rounded search input with a magnifier. */
export function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <label className={styles.search}>
      <span aria-hidden>🔍</span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("listTools.search")}
        aria-label={t("listTools.search")}
        maxLength={100}
      />
    </label>
  );
}
