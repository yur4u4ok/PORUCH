import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { BrandMark } from "@/components/layout/BrandMark";
import { InstallCard } from "@/features/pwa/InstallPrompt";
import { LanguageSwitcher } from "@/features/profile/LanguageSwitcher";
import { ThemeToggle } from "@/features/profile/ThemeSwitcher";
import { applyTheme, useThemeStore } from "@/stores/themeStore";
import { rememberAfterAuth } from "@/utils/afterAuth";
import { track } from "@/utils/analytics";

import styles from "./LandingPage.module.css";

/**
 * Signed-out start page. One yellow notice like those taped up at a building entrance says what
 * Poruch is, with three concrete examples; under it the two ways in. Both lead through sign-up
 * and come back to the chosen action afterwards (utils/afterAuth).
 */
const EXAMPLES = [
  { key: "example1", icon: "🔧" },
  { key: "example2", icon: "📦" },
  { key: "example3", icon: "🐕" },
] as const;

export default function LandingPage() {
  // The landing is dark unless the person picked a theme; the app itself follows the system.
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    if (theme === "system") applyTheme("dark");
  }, [theme]);
  // Leaving the landing: back to whatever the person chose (or the system theme). Only on unmount —
  // resetting on every theme change would undo a fresh choice and make the toggle need two taps.
  useEffect(() => () => applyTheme(useThemeStore.getState().theme), []);
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => track("landing_view", "landing"), []);
  // Both actions need an account: remember the choice, sign up, and land right on it afterwards.
  const start = (path: string, event: "create_request_clicked" | "nearby_requests_clicked") => {
    track(event, "landing");
    rememberAfterAuth(path);
    navigate("/auth/register");
  };
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
        <section className={`${styles.paper} ${styles.ask}`} aria-labelledby="hero-title">
          <span className={styles.tape} aria-hidden />
          <h1 id="hero-title" className={styles.paperTitle}>
            {t("landing.heroTitle")}
          </h1>
          <p>{t("landing.heroText")}</p>
          <ul className={styles.examples} aria-label={t("landing.examplesLabel")}>
            {EXAMPLES.map(({ key, icon }) => (
              <li key={key}>
                <span aria-hidden>{icon}</span>
                {t(`landing.${key}`)}
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.join}
            onClick={() => start("/help/create", "create_request_clicked")}
          >
            {t("landing.askCta")}
          </button>
          <button
            type="button"
            className={styles.login}
            onClick={() => start("/nearby", "nearby_requests_clicked")}
          >
            {t("landing.nearbyCta")}
          </button>
          <p className={styles.signIn}>
            {t("landing.haveAccount")} <Link to="/auth/login">{t("landing.login")}</Link>
          </p>
          <p className={styles.free}>{t("landing.notMarketplace")}</p>
        </div>
      </div>

      <InstallCard />

      {/* closed by default: the welcome screen stays short, details are a tap away */}
      <div className={styles.blocks}>
        <details className={styles.block}>
          <summary className={styles.blockTitle}>{t("landing.how")}</summary>
          <ol className={styles.steps}>
            {steps.map((key) => (
              <li key={key}>{t(`landing.${key}`)}</li>
            ))}
          </ol>
        </details>

        <details className={styles.block}>
          <summary className={styles.blockTitle}>{t("landing.trustTitle")}</summary>
          <ul className={styles.trust}>
            {(t("landing.trust", { returnObjects: true }) as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </div>

      <footer className={styles.footer}>
        <Link to="/privacy">{t("legal.privacy")}</Link>
        <Link to="/terms">{t("legal.terms")}</Link>
        <Link to="/contact">{t("support.title")}</Link>
      </footer>
    </main>
  );
}
