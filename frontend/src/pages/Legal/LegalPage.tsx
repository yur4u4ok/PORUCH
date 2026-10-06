import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { BRAND } from "@/app/brand";
import { BrandMark } from "@/components/layout/BrandMark";
import { LanguageSwitcher } from "@/features/profile/LanguageSwitcher";
import { formatDate } from "@/utils/format";

import { LEGAL, LEGAL_UPDATED, type LegalKind } from "./content";
import styles from "./Legal.module.css";

/** Public, no sign-in: privacy policy and terms (also linked from Google's OAuth consent screen). */
export default function LegalPage({ kind }: { kind: LegalKind }) {
  const { t, i18n } = useTranslation();
  // Legal texts exist in Ukrainian and English; every other language reads the English version.
  const lang = i18n.language === "uk" ? "uk" : "en";
  const doc = LEGAL[kind][lang];
  const other: LegalKind = kind === "privacy" ? "terms" : "privacy";

  return (
    <main className={styles.page}>
      <div className="row-between">
        <Link to="/" aria-label={BRAND} style={{ textDecoration: "none" }}>
          <BrandMark />
        </Link>
        <LanguageSwitcher compact />
      </div>
      <article className={styles.doc} lang={lang}>
        <h1>{doc.title}</h1>
        <p className={styles.intro}>{doc.intro}</p>
        {doc.sections.map((section) => (
          <section key={section.title}>
            <h2>{section.title}</h2>
            {section.body.map((part, i) =>
              Array.isArray(part) ? (
                <ul key={i}>
                  {part.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={i}>{part}</p>
              ),
            )}
          </section>
        ))}
        <p className="muted">
          {t("legal.updated", { date: formatDate(LEGAL_UPDATED) })}
          {lang === "en" && i18n.language !== "en" && <> · {t("legal.englishOnly")}</>}
        </p>
      </article>
      <nav className={styles.links}>
        <Link to={`/${other}`}>{LEGAL[other][lang].title}</Link>
        <Link to="/">{t("errors.back")}</Link>
      </nav>
    </main>
  );
}
