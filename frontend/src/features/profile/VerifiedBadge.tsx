import { useTranslation } from "react-i18next";

import { InfoTip } from "@/components/ui";

import styles from "@/pages/Profile/Profile.module.css";

/** Check in a circle next to a name: green when the email is confirmed, grey otherwise; the tip adds the join year. */
export function VerifiedBadge({ verified, since }: { verified: boolean; since: string }) {
  const { t } = useTranslation();
  const label = t(verified ? "profile.verified" : "profile.emailNotVerified");
  return (
    <InfoTip
      label={label}
      text={
        <>
          {label}
          <br />
          {t("common.since", { year: new Date(since).getFullYear() })}
        </>
      }
      className={verified ? styles.verified : styles.unverified}
      icon={
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="11" fill="currentColor" />
          <path
            d="M7 12.5l3.2 3.2L17 9"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      }
    />
  );
}
