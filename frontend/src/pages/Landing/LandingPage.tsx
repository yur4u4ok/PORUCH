import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { BrandMark } from "@/components/layout/BrandMark";
import { Button } from "@/components/ui";
import { InstallCard } from "@/features/pwa/InstallPrompt";
import { LanguageSwitcher } from "@/features/profile/LanguageSwitcher";
import { emergencyVars } from "@/utils/emergency";

import styles from "./Landing.module.css";

export default function LandingPage() {
  const { t } = useTranslation();
  return (
    <main className={styles.hero}>
      <div className="row-between">
        <BrandMark size="lg" />
        <LanguageSwitcher compact />
      </div>
      <h1 className={styles.title}>{t("landing.title")}</h1>
      <div className={styles.duo}>
        <section className={`${styles.panel} ${styles.panelNeed}`}>
          <h2>🆘 {t("landing.needHelpTitle")}</h2>
          <p>{t("landing.needHelpText")}</p>
        </section>
        <section className={`${styles.panel} ${styles.panelCan}`}>
          <h2>🤝 {t("landing.canHelpTitle")}</h2>
          <p>{t("landing.canHelpText")}</p>
        </section>
      </div>
      <InstallCard />
      <div className="stack-sm">
        <Link to="/auth/register">
          <Button size="lg" block>
            {t("landing.join")}
          </Button>
        </Link>
        <Link to="/auth/login">
          <Button variant="secondary" block>
            {t("landing.login")}
          </Button>
        </Link>
      </div>
      <details className={styles.fold}>
        <summary>{t("landing.how")}</summary>
        <ol className={styles.steps}>
          <li>{t("landing.step1")}</li>
          <li>{t("landing.step2")}</li>
          <li>{t("landing.step3")}</li>
          <li>{t("landing.step4")}</li>
        </ol>
      </details>
      <details className={`${styles.fold} ${styles.trust}`}>
        <summary>{t("landing.trustTitle")}</summary>
        <ul>
          {(t("landing.trust", { returnObjects: true }) as string[]).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
      <p className={`muted ${styles.notice}`}>⚠️ {t("emergency.short", emergencyVars())}</p>
      <nav
        className={`muted ${styles.notice}`}
        style={{ display: "flex", gap: 16, justifyContent: "center" }}
      >
        <Link to="/privacy">{t("legal.privacy")}</Link>
        <Link to="/terms">{t("legal.terms")}</Link>
      </nav>
    </main>
  );
}
