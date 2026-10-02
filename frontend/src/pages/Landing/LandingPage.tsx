import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Button } from "@/components/ui";
import { LanguageSwitcher } from "@/features/profile/LanguageSwitcher";

import styles from "./Landing.module.css";

export default function LandingPage() {
  const { t } = useTranslation();
  return (
    <main className={styles.hero}>
      <div className="row-between">
        <img src="/icons/favicon.svg" alt="" className={styles.logo} />
        <div style={{ width: 120 }}>
          <LanguageSwitcher compact />
        </div>
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
      <section className="stack-sm">
        <h3>{t("landing.how")}</h3>
        <ol className={styles.steps}>
          <li>{t("landing.step1")}</li>
          <li>{t("landing.step2")}</li>
          <li>{t("landing.step3")}</li>
          <li>{t("landing.step4")}</li>
        </ol>
      </section>
      <section className={styles.trust} aria-labelledby="trust-title">
        <h3 id="trust-title">{t("landing.trustTitle")}</h3>
        <ul>
          {(t("landing.trust", { returnObjects: true }) as string[]).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <p className={`muted ${styles.notice}`}>⚠️ {t("emergency.short")}</p>
    </main>
  );
}
