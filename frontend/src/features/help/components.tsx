import clsx from "clsx";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

import { Button, Chip, Modal, Select, Textarea } from "@/components/ui";
import { useReport } from "@/features/profile/hooks";
import { toast } from "@/stores/toastStore";
import type {
  Category,
  HelpRequest,
  HelpRequestStatus,
  NotificationCategory,
  ReportReason,
  Urgency,
} from "@/types/api";
import { CATEGORY_EMOJI, CATEGORY_ORDER, URGENCY_EMOJI, URGENCY_HEX, requestEmoji } from "@/utils/categories";
import { formatDateTime, formatDistance, formatRadius, timeAgo } from "@/utils/format";
import { emergencyVars } from "@/utils/emergency";

import styles from "./components.module.css";

/** Solid, high-contrast labels: they must read on white cards and on the yellow notice alike. */
export function UrgencyBadge({ urgency, neededAt }: { urgency: Urgency; neededAt?: string | null }) {
  const { t } = useTranslation();
  return (
    <span className={styles.pill} style={{ background: URGENCY_HEX[urgency] }}>
      {URGENCY_EMOJI[urgency]}{" "}
      {urgency === "SCHEDULED" && neededAt ? formatDateTime(neededAt) : t(`urgency.${urgency}`)}
    </span>
  );
}

const STATUS_COLOR: Record<HelpRequestStatus, string> = {
  ACTIVE: "var(--color-primary)",
  IN_PROGRESS: "#6a4c9c",
  COMPLETED: "#1f7a4d",
  CANCELLED: "#4b5856",
  EXPIRED: "#4b5856",
};

export function StatusBadge({ status }: { status: HelpRequestStatus }) {
  const { t } = useTranslation();
  return (
    <span className={styles.pill} style={{ background: STATUS_COLOR[status] ?? "#4b5856" }}>
      {status === "COMPLETED" ? "✓ " : ""}
      {t(`status.${status}`)}
    </span>
  );
}

export function HelpRequestCard({
  request,
  showStatus = false,
}: {
  request: HelpRequest;
  showStatus?: boolean;
}) {
  const { t } = useTranslation();
  // A note pinned to the board: the coloured edge on top says how urgent it is.
  return (
    <Link
      to={`/help/${request.id}`}
      className={styles.note}
      style={{ "--urgency": URGENCY_HEX[request.urgency] } as CSSProperties}
    >
      <div className={styles.card}>
        <div className={styles.emoji} aria-hidden>
          {requestEmoji(request.category, request.subcategory)}
        </div>
        <div className={styles.body}>
          <div className={styles.title}>{request.title}</div>
          <div className={styles.description}>{request.description}</div>
          <div className={styles.meta}>
            {showStatus ? (
              <StatusBadge status={request.status} />
            ) : (
              <UrgencyBadge urgency={request.urgency} neededAt={request.needed_at} />
            )}
            {request.distance_m != null && (
              <span>📍 {t("common.fromYou", { distance: formatDistance(request.distance_m) })}</span>
            )}
            <span>{timeAgo(request.created_at)}</span>
            {request.helpers_needed > 1 && (
              <span>
                👥 {t("request.peopleStillNeeded", { count: request.helpers_needed - request.helpers_count })}
              </span>
            )}
            {request.reward_type === "WILLING" && <span>💰</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function CategoryChips<T extends Category | NotificationCategory>({
  options,
  selected,
  onToggle,
  labelKey = "categories",
}: {
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  labelKey?: "categories" | "notificationCategories";
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.chips}>
      {options.map((value) => (
        <Chip key={value} active={selected.includes(value)} onClick={() => onToggle(value)}>
          {CATEGORY_EMOJI[value as Category]} {t(`${labelKey}.${value}`)}
        </Chip>
      ))}
    </div>
  );
}

export function RadiusChips({
  radii,
  value,
  onChange,
}: {
  radii: number[];
  value: number;
  onChange: (radius: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.chips} role="radiogroup" aria-label={t("nearby.radius")}>
      {radii.map((r) => (
        <Chip key={r} active={value === r} onClick={() => onChange(r)}>
          {formatRadius(r)}
        </Chip>
      ))}
    </div>
  );
}

export function CategoryGrid({
  value,
  onChange,
}: {
  value: Category | null;
  onChange: (category: Category) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.grid} role="radiogroup">
      {CATEGORY_ORDER.map((category) => (
        <button
          key={category}
          type="button"
          role="radio"
          aria-checked={value === category}
          className={clsx(
            styles.tile,
            value === category && styles.tileActive,
            category === "URGENT" && styles.tileUrgent,
          )}
          onClick={() => onChange(category)}
        >
          <span aria-hidden>{CATEGORY_EMOJI[category]}</span>
          <span>{t(`categories.${category}`)}</span>
        </button>
      ))}
    </div>
  );
}

export function OptionTiles<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; icon: ReactNode; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="stack-sm" role="radiogroup">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={clsx(styles.tile, value === option.value && styles.tileActive)}
          style={{ flexDirection: "row", alignItems: "center", minHeight: 64 }}
          onClick={() => onChange(option.value)}
        >
          <span aria-hidden>{option.icon}</span>
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function EmergencyDisclaimer({
  open,
  onAccept,
  onClose,
}: {
  open: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`🚨 ${t("emergency.title")}`}
      actions={
        <>
          <Button
            variant="secondary"
            onClick={() => (window.location.href = `tel:${emergencyVars().number}`)}
          >
            📞 {t("emergency.call", emergencyVars())}
          </Button>
          <Button onClick={onAccept}>{t("common.understood")}</Button>
        </>
      }
    >
      <p>{t("emergency.text")}</p>
    </Modal>
  );
}

const REPORT_REASONS: ReportReason[] = ["SPAM", "FRAUD", "HARASSMENT", "DANGEROUS", "INAPPROPRIATE", "OTHER"];

export function ReportDialog({
  open,
  onClose,
  target,
}: {
  open: boolean;
  onClose: () => void;
  target: { target_user_id?: string; help_request_id?: string; message_id?: string };
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>("SPAM");
  const [description, setDescription] = useState("");
  const report = useReport();
  const submit = () =>
    report.mutate(
      { reason, description, ...target },
      {
        onSuccess: () => {
          toast.success(t("report.sent"));
          setDescription("");
          onClose();
        },
      },
    );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("report.title")}
      actions={
        <Button onClick={submit} loading={report.isPending}>
          {t("report.send")}
        </Button>
      }
    >
      <Select
        label={t("report.reason")}
        value={reason}
        onChange={(e) => setReason(e.target.value as ReportReason)}
      >
        {REPORT_REASONS.map((r) => (
          <option key={r} value={r}>
            {t(`report.${r}`)}
          </option>
        ))}
      </Select>
      <Textarea
        label={t("report.description")}
        value={description}
        maxLength={1000}
        onChange={(e) => setDescription(e.target.value)}
      />
    </Modal>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  text,
  confirmLabel,
  loading,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  text?: string;
  confirmLabel: string;
  loading?: boolean;
  danger?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant={danger ? "primary" : "help"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {text && <p>{text}</p>}
    </Modal>
  );
}
