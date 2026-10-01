import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { Avatar } from "@/components/ui";
import type { PublicUser } from "@/types/api";

import styles from "@/pages/HelpRequest/HelpRequest.module.css";

export function PersonRow({
  user,
  children,
  link = true,
}: {
  user: PublicUser;
  children?: ReactNode;
  link?: boolean;
}) {
  const { t } = useTranslation();
  const name = user.display_name ?? t("common.anonymous");
  const info = (
    <>
      <Avatar name={name} media={user.avatar} size={48} />
      <div className={styles.personInfo}>
        <div className={styles.personName}>{name}</div>
        <div className={styles.personStats}>
          {t("profile.helpedShort", { count: user.helped_count })} ·{" "}
          {t("profile.thanksShort", { count: user.thanks_received_count })}
        </div>
      </div>
    </>
  );
  return (
    <div className={styles.person}>
      {link ? (
        <Link
          to={`/profile/${user.id}`}
          className={styles.person}
          style={{ flex: 1, textDecoration: "none" }}
        >
          {info}
        </Link>
      ) : (
        info
      )}
      {children}
    </div>
  );
}
