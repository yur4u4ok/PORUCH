import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Button, EmptyState, ErrorState, SkeletonList } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { AvailabilityToggle } from "@/features/help/AvailabilityToggle";
import { HelpRequestCard } from "@/features/help/components";
import { useHelpHistory, useHelpRequests } from "@/features/help/hooks";
import { useGeolocation } from "@/features/location/useGeolocation";
import { useSyncNotificationLocation } from "@/features/location/useSyncNotificationLocation";
import { usePreferences } from "@/features/profile/hooks";

import { cityName } from "@/utils/city";

import styles from "./Home.module.css";

function LocationHeader() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  return (
    <div className={styles.location}>
      📍 {me?.city ? cityName(me.city, i18n.language) : t("home.locationUnknown")}
    </div>
  );
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

function MyActiveHelp() {
  const { t } = useTranslation();
  const asAuthor = useHelpHistory({ role: "author", status: ["ACTIVE", "IN_PROGRESS"] });
  const asHelper = useHelpHistory({ role: "helper", status: ["IN_PROGRESS"] });
  const items = [...(asAuthor.data?.pages[0]?.results ?? []), ...(asHelper.data?.pages[0]?.results ?? [])];
  if (!items.length) return null;
  return (
    <section className={styles.section}>
      <h2>{t("home.myActive")}</h2>
      {items.map((request) => (
        <HelpRequestCard key={request.id} request={request} showStatus />
      ))}
    </section>
  );
}

function NearbyRequestsPreview() {
  const { t } = useTranslation();
  const { position, status, locate } = useGeolocation();
  const { data: prefs } = usePreferences();
  useEffect(() => {
    void locate();
  }, [locate]);
  useSyncNotificationLocation(position);

  const query = useMemo(
    () =>
      position
        ? { lat: position.latitude, lng: position.longitude, radius: prefs?.notification_radius ?? 3000 }
        : null,
    [position, prefs?.notification_radius],
  );
  const nearby = useHelpRequests(query);
  const items = nearby.data?.pages[0]?.results.slice(0, 5) ?? [];

  return (
    <section className={styles.section}>
      <div className="row-between">
        <h2>{t("home.nearbyPreview")}</h2>
        <Link to="/nearby">{t("common.seeAll")}</Link>
      </div>
      {!position && status !== "locating" ? (
        <EmptyState
          icon="📍"
          title={t("home.enableLocation")}
          action={
            <Button variant="secondary" onClick={() => void locate({ force: true })}>
              {t("nearby.allowLocation")}
            </Button>
          }
        />
      ) : nearby.isPending ? (
        <SkeletonList count={3} />
      ) : nearby.isError ? (
        <ErrorState onRetry={() => void nearby.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="🌤" title={t("nearby.emptyTitle")} text={t("nearby.emptyText")} />
      ) : (
        items.map((request) => <HelpRequestCard key={request.id} request={request} />)
      )}
    </section>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  return (
    <main className="page stack">
      <LocationHeader />
      <EmergencyHelpButton />
      <NearbyHelpButton />
      <Link to="/nearby?view=map" className={styles.mapLink}>
        🗺 {t("home.nearbyMap")}
      </Link>
      <AvailabilityToggle />
      <MyActiveHelp />
      <NearbyRequestsPreview />
      <p className="muted" style={{ fontSize: 13 }}>
        ⚠️ {t("emergency.short")}
      </p>
    </main>
  );
}
