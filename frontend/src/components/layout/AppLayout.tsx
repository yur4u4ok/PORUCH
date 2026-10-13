import clsx from "clsx";
import { useEffect, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { BRAND } from "@/app/brand";
import { NavLink, Outlet, useNavigate, useSearchParams } from "react-router";

import { IconButton } from "@/components/ui";
import { useLogoutConfirm } from "@/features/auth/LogoutConfirm";
import { AttentionSignals } from "@/features/attention/AttentionSignals";
import { InstallPrompt } from "@/features/pwa/InstallPrompt";

import { BrandMark } from "./BrandMark";
import {
  AroundIcon,
  BellIcon,
  ChatIcon,
  CreateIcon,
  HomeIcon,
  LogoutIcon,
  ProfileIcon,
  SupportIcon,
} from "./NavIcons";
import { PullToRefresh } from "./PullToRefresh";
import { useConversations } from "@/features/chat/hooks";
import { useMarkNotificationRead, useUnreadCount } from "@/features/notifications/hooks";
import { useOnline } from "@/hooks/useOnline";

import styles from "./AppLayout.module.css";

interface NavEntry {
  to: string;
  icon: ReactNode;
  label: string;
  badge?: number;
  end?: boolean;
}

function useNavEntries(): NavEntry[] {
  const { t } = useTranslation();
  const { data: conversations } = useConversations();
  const unreadChats = conversations?.results.reduce((sum, c) => sum + c.unread_count, 0) ?? 0;
  const { data: unread = 0 } = useUnreadCount(true);
  return [
    { to: "/", icon: <HomeIcon />, label: t("nav.home"), end: true },
    { to: "/nearby", icon: <AroundIcon />, label: t("nav.nearby") },
    { to: "/help/create", icon: <CreateIcon />, label: t("nav.help") },
    { to: "/chats", icon: <ChatIcon />, label: t("nav.chats"), badge: unreadChats },
    { to: "/notifications", icon: <BellIcon />, label: t("nav.notifications"), badge: unread },
    { to: "/profile", icon: <ProfileIcon />, label: t("nav.profile"), end: true },
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
  const logout = useLogoutConfirm();
  const chatBadge = entries.find((e) => e.to === "/chats")?.badge ?? 0;

  return (
    <div className={styles.shell}>
      <PushDeepLinkTracker />
      <PullToRefresh />
      <AttentionSignals unread={unread + chatBadge} />
      <InstallPrompt />
      <nav className={styles.sidebar} aria-label={BRAND}>
        <NavLink to="/" className={styles.brand}>
          <BrandMark inverse />
        </NavLink>
        {entries.map((entry) => (
          <NavLink
            key={entry.to}
            to={entry.to}
            end={entry.end}
            className={({ isActive }) => clsx(styles.sideItem, isActive && styles.sideActive)}
          >
            <span className={styles.sideIcon} aria-hidden>
              {entry.icon}
            </span>
            {entry.label}
            {!!entry.badge && <span className={styles.dot}>{entry.badge}</span>}
          </NavLink>
        ))}
        <NavLink
          to="/support"
          className={({ isActive }) =>
            clsx(styles.sideItem, styles.sideBottom, isActive && styles.sideActive)
          }
        >
          <SupportIcon />
          {t("support.title")}
        </NavLink>
        <button type="button" className={styles.sideItem} onClick={logout.ask}>
          <LogoutIcon />
          {t("auth.logout")}
        </button>
        {logout.dialog}
      </nav>
      <div className={styles.main}>
        <OfflineBanner />
        <Outlet />
      </div>
      <nav className={styles.bottomNav} aria-label={BRAND}>
        {/* phones: notifications are the bell on the home screen, not a tab */}
        {entries
          .filter((entry) => entry.to !== "/notifications")
          .map((entry) => (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              className={({ isActive }) => clsx(styles.navItem, isActive && styles.navActive)}
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

/** Round «back» button with a drawn arrow: a text «←» sits off-centre in most fonts. */
export function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <IconButton label={label} onClick={onClick} className={styles.back}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </IconButton>
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
        <BackButton
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          label={t("nav.back")}
        />
      )}
      <h1 className={styles.headerTitle}>{title}</h1>
      {actions}
    </header>
  );
}
