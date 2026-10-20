import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { helpRequestsApi, type HistoryQuery } from "@/api/helpRequests";
import { queryKeys } from "@/api/queryKeys";
import { ListTools, PagedBlock, Switcher } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { HelpRequestCard } from "@/features/help/components";
import { useGeolocation } from "@/features/location/useGeolocation";
import { useSyncNotificationLocation } from "@/features/location/useSyncNotificationLocation";
import { useUnreadCount } from "@/features/notifications/hooks";
import { HISTORY_SORTS, useListFilter } from "@/hooks/useListFilter";
import { PAGE_SIZE, usePagedList } from "@/hooks/usePagedList";
import type { Category } from "@/types/api";
import { CATEGORY_EMOJI } from "@/utils/categories";

import { BrandMark } from "@/components/layout/BrandMark";
import { BellIcon } from "@/components/layout/NavIcons";

import styles from "./Home.module.css";

/** The tear-off tabs at the bottom of the notice: each one starts a request in that category. */
const TABS: Category[] = ["AUTO", "HOME", "ITEMS", "ANIMALS", "PEOPLE", "OTHER"];

function Greeting() {
  const { data: me } = useMe();
  const { t } = useTranslation();
  return (
    <header className={styles.greeting}>
      <div className={styles.greetingTop}>
        {/* phones have no sidebar with the logo, so it sits here */}
        <BrandMark className={styles.brand} />
        <NotificationsBell />
      </div>
      {me?.display_name && <h1 className={styles.hello}>{t("home.hello", { name: me.display_name })}</h1>}
    </header>
  );
}

/** Phones: notifications live here, top right, instead of a bottom-menu tab (the sidebar keeps it). */
function NotificationsBell() {
  const { t } = useTranslation();
  const { data: unread = 0 } = useUnreadCount(true);
  const label = unread ? `${t("nav.notifications")}: ${unread}` : t("nav.notifications");
  return (
    <Link to="/notifications" className={styles.bell} aria-label={label} title={t("nav.notifications")}>
      <BellIcon />
      {unread > 0 && <span className={styles.bellBadge}>{unread > 99 ? "99+" : unread}</span>}
    </Link>
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

/**
 * «Мої запити» and «Я допомагаю» behind one compact switch, the chosen list right under it —
 * the two never mix. Opens on the list that has something in it.
 */
function MyActiveHelp() {
  const { t } = useTranslation();
  const fetchHistory = (query: HistoryQuery) => (page: number, signal: AbortSignal) =>
    helpRequestsApi.history({ ...query, page, page_size: PAGE_SIZE }, signal);
  const filter = useListFilter("newest");
  const refine = { q: filter.q || undefined, sort: filter.sort };
  const mineQuery: HistoryQuery = { role: "author", status: ["ACTIVE", "IN_PROGRESS"], ...refine };
  const helpingQuery: HistoryQuery = { role: "helper", status: ["IN_PROGRESS"], ...refine };
  const mine = usePagedList(queryKeys.history(mineQuery), fetchHistory(mineQuery));
  const helping = usePagedList(queryKeys.history(helpingQuery), fetchHistory(helpingQuery));
  const [picked, setPicked] = useState<"mine" | "helping" | null>(null);
  const tab = picked ?? (mine.count === 0 && helping.count > 0 ? "helping" : "mine");
  const list = tab === "mine" ? mine : helping;
  return (
    <section className={styles.section}>
      <Switcher
        label={t("home.myActivity")}
        value={tab}
        onChange={setPicked}
        options={[
          { value: "mine", label: t("home.myRequests"), count: mine.count },
          { value: "helping", label: t("home.imHelping"), count: helping.count },
        ]}
      >
        <ListTools filter={filter} sorts={HISTORY_SORTS} />
        <PagedBlock
          key={tab}
          page={list.page}
          pages={list.pages}
          onPage={list.setPage}
          busy={list.isFetching}
        >
          {list.items.map((request) => (
            <HelpRequestCard key={request.id} request={request} showStatus />
          ))}
          {list.items.length === 0 &&
            !list.isPending &&
            (filter.active ? (
              <p className="muted">{t("listTools.nothingFound")}</p>
            ) : tab === "mine" ? (
              <Link to="/help/create" className={styles.empty}>
                {t("home.noRequests")} <strong>{t("home.createOne")}</strong>
              </Link>
            ) : (
              <Link to="/nearby" className={styles.empty}>
                {t("home.noHelping")} <strong>{t("home.findSomeone")}</strong>
              </Link>
            ))}
        </PagedBlock>
      </Switcher>
    </section>
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
      <MyActiveHelp />
      <NotificationLocationSync />
    </main>
  );
}
