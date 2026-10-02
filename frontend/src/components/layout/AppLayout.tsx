import clsx from "clsx";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { BRAND } from "@/app/brand";
import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router";

import { IconButton } from "@/components/ui";
import { useConversations } from "@/features/chat/hooks";
import { useMarkNotificationRead, useUnreadCount } from "@/features/notifications/hooks";
import { useOnline } from "@/hooks/useOnline";

import styles from "./AppLayout.module.css";

interface NavEntry {
  to: string;
  icon: string;
  label: string;
  badge?: number;
  create?: boolean;
  end?: boolean;
}

function useNavEntries(): NavEntry[] {
  const { t } = useTranslation();
  const { data: conversations } = useConversations();
  const unreadChats = conversations?.results.reduce((sum, c) => sum + c.unread_count, 0) ?? 0;
  return [
    { to: "/", icon: "🏠", label: t("nav.home"), end: true },
    { to: "/nearby", icon: "🗺", label: t("nav.nearby") },
    { to: "/help/create", icon: "+", label: t("nav.help"), create: true },
    { to: "/chats", icon: "💬", label: t("nav.chats"), badge: unreadChats },
    { to: "/profile", icon: "👤", label: t("nav.profile"), end: true },
  ];
}

export function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  if (online) return null;
  return (
    <div className={styles.offline} role="status">
      {t("app.offline")}
    </div>
  );
}

/** Marks a notification opened from a push deep link (?n=<id>) and cleans the URL. */
function PushDeepLinkTracker() {
  const [params, setParams] = useSearchParams();
  const markRead = useMarkNotificationRead();
  const notificationId = params.get("n");
  useEffect(() => {
    if (!notificationId) return;
    markRead.mutate({ id: notificationId, viaPush: true });
    const next = new URLSearchParams(params);
    next.delete("n");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationId]);
  return null;
}

export function AppLayout() {
  const { t } = useTranslation();
  const entries = useNavEntries();
  const { data: unread = 0 } = useUnreadCount(true);

  return (
    <div className={styles.shell}>
      <PushDeepLinkTracker />
      <nav className={styles.sidebar} aria-label={BRAND}>
        <NavLink to="/" className={styles.brand}>
          <img src="/icons/favicon.svg" alt="" />
          {BRAND}
        </NavLink>
        {[
          ...entries,
          { to: "/notifications", icon: "🔔", label: t("nav.notifications"), badge: unread },
          { to: "/settings", icon: "⚙️", label: t("nav.settings") },
        ].map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.end}
            className={({ isActive }) => clsx(styles.sideItem, isActive && styles.sideActive)}
          >
            <span aria-hidden>{entry.icon}</span>
            {entry.label}
            {!!entry.badge && <span className={styles.dot}>{entry.badge}</span>}
          </NavLink>
        ))}
      </nav>
      <div className={styles.main}>
        <OfflineBanner />
        <Outlet />
      </div>
      <nav className={styles.bottomNav} aria-label={BRAND}>
        {entries.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.end}
            className={({ isActive }) =>
              clsx(
                styles.navItem,
                entry.create && styles.navCreate,
                isActive && !entry.create && styles.navActive,
              )
            }
          >
            <span className={styles.navIcon} aria-hidden>
              {entry.icon}
            </span>
            {entry.label}
            {!!entry.badge && <span className={styles.dot}>{entry.badge}</span>}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  back = true,
  actions,
}: {
  title: ReactNode;
  back?: boolean;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <header className={styles.header}>
      {back && (
        <IconButton
          label={t("nav.back")}
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
        >
          ←
        </IconButton>
      )}
      <h1 className={styles.headerTitle}>{title}</h1>
      {actions}
    </header>
  );
}
