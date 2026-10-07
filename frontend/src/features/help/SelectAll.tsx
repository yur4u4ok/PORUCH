import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui";

/** «Вибрати все» / «Зняти все» for a list of chips. */
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
  const everything = all.length > 0 && all.every((item) => selected.includes(item));
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(everything ? [] : [...all])}
      style={{ alignSelf: "flex-start" }}
    >
      {everything ? `☐ ${t("common.selectNone")}` : `☑ ${t("common.selectAll")}`}
    </Button>
  );
}
