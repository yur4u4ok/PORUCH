import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useMe } from "@/features/auth/hooks";
import { HelpRequestCard } from "@/features/help/components";
import { useHelpHistory } from "@/features/help/hooks";
import { usePlace } from "@/features/location/place";
import { useGeolocation } from "@/features/location/useGeolocation";
import { useSyncNotificationLocation } from "@/features/location/useSyncNotificationLocation";
import { InstallCard } from "@/features/pwa/InstallPrompt";
import type { Category } from "@/types/api";
import { CATEGORY_EMOJI } from "@/utils/categories";
import { cityName } from "@/utils/city";

import styles from "./Home.module.css";

/** The tear-off tabs at the bottom of the notice: each one starts a request in that category. */
const TABS: Category[] = ["AUTO", "HOME", "ITEMS", "ANIMALS", "PEOPLE", "OTHER"];

function Greeting() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const place = usePlace();
  const name = place?.name ?? (me?.city ? cityName(me.city, i18n.language) : null);
  return (
    <header className={styles.greeting}>
      <span className={styles.place}>📍 {name ?? t("home.locationUnknown")}</span>
      {me?.display_name && <h1 className={styles.hello}>{t("home.hello", { name: me.display_name })}</h1>}
    </header>
  );
}

/**
 * The one loud thing on the screen: a yellow notice like the ones taped to a building entrance,
 * with tear-off tabs. Asking for help is the main action of the app.
 */
function AskNotice() {
  const { t } = useTranslation();
  return (
    <section className={styles.notice} aria-labelledby="ask-title">
      <span className={styles.tape} aria-hidden />
      <div className={styles.noticeBody}>
        <h2 id="ask-title" className={styles.noticeTitle}>
          {t("home.needHelp")}?
        </h2>
        <p className={styles.noticeText}>{t("home.needHelpSub")}</p>
        <Link to="/help/create" className={styles.askButton}>
          {t("home.ask")}
        </Link>
      </div>
      <p className={styles.tabsHint}>{t("home.orPick")}</p>
      <nav className={styles.tabs} aria-label={t("home.orPick")}>
        {TABS.map((category) => (
          <Link key={category} to={`/help/create?category=${category}`} className={styles.tab}>
            <span aria-hidden>{CATEGORY_EMOJI[category]}</span>
            <span className={styles.tabLabel}>{t(`categories.${category}`)}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

function NearbyLink() {
  const { t } = useTranslation();
  return (
    <Link to="/nearby" className={styles.nearby}>
      <span className={styles.nearbyHeart} aria-hidden>
        ❤️
      </span>
      <span className={styles.nearbyText}>
        <strong>{t("home.someoneNeeds")}</strong>
        <small>{t("home.someoneNeedsSub")}</small>
      </span>
      <span className={styles.chevron} aria-hidden>
        ›
      </span>
    </Link>
  );
}

function HomeSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {title}
        {count > 0 && <span className={styles.count}>{count}</span>}
      </h2>
      {children}
    </section>
  );
}

/** Two separate lists so "what I posted" never mixes with "where I help"; always shown, with a hint when empty. */
function MyActiveHelp() {
  const { t } = useTranslation();
  const asAuthor = useHelpHistory({ role: "author", status: ["ACTIVE", "IN_PROGRESS"] });
  const asHelper = useHelpHistory({ role: "helper", status: ["IN_PROGRESS"] });
  const mine = asAuthor.data?.pages[0]?.results ?? [];
  const helping = asHelper.data?.pages[0]?.results ?? [];
  return (
    <>
      <HomeSection title={t("home.myRequests")} count={mine.length}>
        {mine.length > 0
          ? mine.map((request) => <HelpRequestCard key={request.id} request={request} showStatus />)
          : !asAuthor.isPending && (
              <Link to="/help/create" className={styles.empty}>
                {t("home.noRequests")} <strong>{t("home.createOne")}</strong>
              </Link>
            )}
      </HomeSection>
      <HomeSection title={t("home.imHelping")} count={helping.length}>
        {helping.length > 0
          ? helping.map((request) => <HelpRequestCard key={request.id} request={request} showStatus />)
          : !asHelper.isPending && (
              <Link to="/nearby" className={styles.empty}>
                {t("home.noHelping")} <strong>{t("home.findSomeone")}</strong>
              </Link>
            )}
      </HomeSection>
    </>
  );
}

/** Keeps the location for nearby notifications fresh when the home screen opens (no UI). */
function NotificationLocationSync() {
  const { position, locate } = useGeolocation();
  useEffect(() => {
    void locate();
  }, [locate]);
  useSyncNotificationLocation(position);
  return null;
}

export default function HomePage() {
  return (
    <main className={`page ${styles.home}`}>
      <Greeting />
      <AskNotice />
      <NearbyLink />
      <InstallCard />
      <MyActiveHelp />
      <NotificationLocationSync />
    </main>
  );
}
