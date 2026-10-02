import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Media } from "@/types/api";

import { Button } from "./Button";
import styles from "./Surface.module.css";

export function Card({ to, className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { to?: string }) {
  if (to) {
    return (
      <Link to={to} className={clsx(styles.card, styles.interactive, className)}>
        {children}
      </Link>
    );
  }
  return (
    <div className={clsx(styles.card, className)} {...rest}>
      {children}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "danger" | "info" | "warning" | "success" | "count";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx(styles.badge, tone !== "neutral" && styles[`badge-${tone}`], className)}>
      {children}
    </span>
  );
}

export function Avatar({
  name,
  media,
  size = 40,
}: {
  name?: string | null;
  media?: Media | null;
  size?: number;
}) {
  const { t } = useTranslation();
  const label = name || t("common.anonymous");
  const src = media?.thumbnail_url || media?.url;
  return (
    <span className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {src ? <img src={src} alt="" loading="lazy" /> : label.trim().charAt(0).toUpperCase()}
    </span>
  );
}

export function Chip({
  active,
  children,
  onClick,
  ariaLabel,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className={clsx(styles.chip, active && styles.chipActive)}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={clsx(styles.tab, option.value === value && styles.tabActive)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({
  height = 16,
  width = "100%",
  className,
}: {
  height?: number;
  width?: number | string;
  className?: string;
}) {
  return <div className={clsx(styles.skeleton, className)} style={{ height, width }} aria-hidden />;
}

export function SkeletonList({ count = 3, height = 96 }: { count?: number; height?: number }) {
  const { t } = useTranslation();
  return (
    <div className="stack" aria-busy aria-label={t("common.loading")}>
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
}

export function EmptyState({
  icon = "🤝",
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  text?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className={styles.state}>
      <div className={styles.stateIcon} aria-hidden>
        {icon}
      </div>
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.state} role="alert">
      <div className={styles.stateIcon} aria-hidden>
        ⚠️
      </div>
      <h3>{message || t("common.error")}</h3>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

export function Loader({ label }: { label?: string }) {
  const { t } = useTranslation();
  return (
    <div className={styles.loader} role="status" aria-label={label ?? t("common.loading")}>
      <span className={styles.loaderSpin} />
    </div>
  );
}
