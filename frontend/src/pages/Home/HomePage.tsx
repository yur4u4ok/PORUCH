import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useMe } from "@/features/auth/hooks";
import { HelpRequestCard } from "@/features/help/components";
import { useHelpHistory } from "@/features/help/hooks";
import { useGeolocation } from "@/features/location/useGeolocation";
import { useSyncNotificationLocation } from "@/features/location/useSyncNotificationLocation";

import { cityName } from "@/utils/city";
import { usePlace } from "@/features/location/place";
import { InstallCard } from "@/features/pwa/InstallPrompt";

import styles from "./Home.module.css";

function LocationHeader() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const place = usePlace();
  const name = place?.name ?? (me?.city ? cityName(me.city, i18n.language) : null);
  return <div className={styles.location}>📍 {name ?? t("home.locationUnknown")}</div>;
}

function EmergencyHelpButton() {
  const { t } = useTranslation();
  return (
    <Link to="/help/create" className={styles.sos}>
      <span className={styles.sosLight} aria-hidden />
      <span className={styles.sosIcon} aria-hidden>
        +
      </span>
      <span>
        <span className={styles.sosTitle}>{t("home.needHelp")}</span>
        <span className={styles.sosSub}>{t("home.needHelpSub")}</span>
      </span>
    </Link>
  );
}

function NearbyHelpButton() {
  const { t } = useTranslation();
  return (
    <Link to="/nearby" className={styles.helpButton}>
      <span className={styles.helpIcon} aria-hidden>
        🤝
      </span>
      <span>
        <strong>{t("home.someoneNeeds")}</strong>
        <small>{t("home.someoneNeedsSub")}</small>
      </span>
    </Link>
  );
}

function HomeSection({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.section}>
      <div className="row-between">
        <div>
          <h2>{title}</h2>
          <p className="muted" style={{ fontSize: 14 }}>
            {hint}
          </p>
        </div>
        {action}
      </div>
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
      <HomeSection title={t("home.myRequests")} hint={t("home.myRequestsHint")}>
        {mine.length > 0
          ? mine.map((request) => <HelpRequestCard key={request.id} request={request} showStatus />)
          : !asAuthor.isPending && (
              <Link to="/help/create" className={styles.empty}>
                {t("home.noRequests")} <strong>{t("home.createOne")}</strong>
              </Link>
            )}
      </HomeSection>
      <HomeSection title={t("home.imHelping")} hint={t("home.imHelpingHint")}>
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
    <main className="page stack">
      <LocationHeader />
      <InstallCard />
      <EmergencyHelpButton />
      <NearbyHelpButton />
      <MyActiveHelp />
      <NotificationLocationSync />
    </main>
  );
}
