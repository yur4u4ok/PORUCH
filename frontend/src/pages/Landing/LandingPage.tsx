import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { BrandMark } from "@/components/layout/BrandMark";
import { InstallCard } from "@/features/pwa/InstallPrompt";
import { LanguageSwitcher } from "@/features/profile/LanguageSwitcher";
import { ThemeToggle } from "@/features/profile/ThemeSwitcher";
import { applyTheme, useThemeStore } from "@/stores/themeStore";

import styles from "./LandingPage.module.css";

/**
 * Signed-out start page. The same picture as the home screen inside the app: notices on the wall
 * of a building entrance — a yellow one asking for help and a white one offering it — and right
 * under them the two ways in.
 */
export default function LandingPage() {
  // The landing is dark unless the person picked a theme; the app itself follows the system.
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    if (theme !== "system") return;
    applyTheme("dark");
    return () => applyTheme("system");
  }, [theme]);
  const { t } = useTranslation();
  const steps = ["step1", "step2", "step3", "step4"] as const;
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <BrandMark />
        <div className={styles.topControls}>
          <ThemeToggle fallback="dark" />
          <LanguageSwitcher compact />
        </div>
      </header>

      <div className={styles.hero}>
        <div className={styles.wall} aria-label={t("app.slogan")}>
          <section className={`${styles.paper} ${styles.ask}`}>
            <span className={styles.tape} aria-hidden />
            <h1 className={styles.paperTitle}>{t("landing.needHelpTitle")}</h1>
            <p>{t("landing.needHelpText")}</p>
          </section>
          <section className={`${styles.paper} ${styles.offer}`}>
            <span className={styles.tape} aria-hidden />
            <h2 className={styles.paperTitle}>{t("landing.canHelpTitle")}</h2>
            <p>{t("landing.canHelpText")}</p>
          </section>
        </div>

        <div className={styles.actions}>
          <Link to="/auth/register" className={styles.join}>
            {t("landing.join")}
          </Link>
          <Link to="/auth/login" className={styles.login}>
            {t("landing.login")}
          </Link>
          <p className={styles.free}>{t("landing.notMarketplace")}</p>
        </div>
      </div>

      <InstallCard />

      <section className={styles.block} aria-labelledby="how">
        <h2 id="how" className={styles.blockTitle}>
          {t("landing.how")}
        </h2>
        <ol className={styles.steps}>
          {steps.map((key) => (
            <li key={key}>{t(`landing.${key}`)}</li>
          ))}
        </ol>
      </section>

      <section className={styles.block} aria-labelledby="trust">
        <h2 id="trust" className={styles.blockTitle}>
          {t("landing.trustTitle")}
        </h2>
        <ul className={styles.trust}>
          {(t("landing.trust", { returnObjects: true }) as string[]).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <Link to="/privacy">{t("legal.privacy")}</Link>
        <Link to="/terms">{t("legal.terms")}</Link>
      </footer>
    </main>
  );
}
