import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { BrandMark } from "@/components/layout/BrandMark";
import { LanguageSwitcher } from "@/features/profile/LanguageSwitcher";
import { ThemeToggle } from "@/features/profile/ThemeSwitcher";
import { rememberAfterAuth } from "@/utils/afterAuth";
import { track } from "@/utils/analytics";

import styles from "./LandingPage.module.css";

/**
 * Signed-out start page. One yellow notice like those taped up at a building entrance says what
 * Poruch is, with three concrete examples; under it the two ways in. Both lead through sign-up
 * and come back to the chosen action afterwards (utils/afterAuth).
 */
const TRUST_ICONS = ["📍", "✅", "💚", "🛡️"];
// screenshots of the app itself, taken on a phone in the light theme
const SHOTS = ["nearby", "request", "chat"] as const;

const EXAMPLES = [
  { key: "example1", icon: "🔧" },
  { key: "example2", icon: "📦" },
  { key: "example3", icon: "🐕" },
] as const;

export default function LandingPage() {
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
          <ThemeToggle />
          <LanguageSwitcher compact />
        </div>
      </header>

      <p className={styles.badge}>
        <span className={styles.badgeIcon} aria-hidden>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="9" cy="8" r="3.2" />
            <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8" />
            <circle cx="16.5" cy="9" r="2.6" />
            <path d="M16 14.3c2.3.1 4 1.6 4.5 4.2" />
          </svg>
        </span>
        {t("landing.communityBadge")}
      </p>

      <div className={styles.hero}>
        <section className={`${styles.paper} ${styles.ask}`} aria-labelledby="hero-title">
          <span className={styles.tape} aria-hidden />
          <h2 id="hero-title" className={styles.paperTitle}>
            {t("landing.heroTitle")}
          </h2>
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
        </div>
      </div>

      <section className={styles.section} aria-labelledby="how-title">
        <h2 id="how-title" className={styles.sectionTitle}>
          {t("landing.how")}
        </h2>
        <ol className={styles.cards}>
          {steps.map((key, i) => (
            <li key={key} className={styles.card}>
              <span className={styles.stepNo}>{t("landing.stepLabel", { n: i + 1 })}</span>
              {t(`landing.${key}`)}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="look-title">
        <h2 id="look-title" className={styles.sectionTitle}>
          {t("landing.lookTitle")}
        </h2>
        <div className={styles.shots}>
          {SHOTS.map((key) => (
            <figure key={key} className={styles.shot}>
              <img
                src={`/landing/${key}.webp`}
                alt={t(`landing.shot_${key}`)}
                width={520}
                height={1125}
                loading="lazy"
              />
              <figcaption>{t(`landing.shot_${key}`)}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="trust-title">
        <h2 id="trust-title" className={styles.sectionTitle}>
          {t("landing.trustTitle")}
        </h2>
        <ul className={styles.cards}>
          {(t("landing.trust", { returnObjects: true }) as string[]).map((item, i) => (
            <li key={item} className={styles.card}>
              <span className={styles.trustIcon} aria-hidden>
                {TRUST_ICONS[i]}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <Link to="/privacy">{t("legal.privacy")}</Link>
        <Link to="/terms">{t("legal.terms")}</Link>
        <Link to="/contact">{t("support.title")}</Link>
      </footer>
    </main>
  );
}
