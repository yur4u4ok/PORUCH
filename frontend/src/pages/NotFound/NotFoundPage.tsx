import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Button, EmptyState } from "@/components/ui";

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="page">
      <EmptyState
        icon="🧭"
        title={t("errors.notFoundTitle")}
        action={
          <Link to="/">
            <Button>{t("errors.back")}</Button>
          </Link>
        }
      />
    </main>
  );
}
