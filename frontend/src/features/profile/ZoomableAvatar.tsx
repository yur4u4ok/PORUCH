import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Avatar, Lightbox } from "@/components/ui";
import type { Media } from "@/types/api";

import styles from "./ZoomableAvatar.module.css";

/** Profile photo that opens full size on tap (own profile and other people's). */
export function ZoomableAvatar({ name, media, size }: { name: string; media: Media | null; size: number }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const src = media?.url;
  if (!src) return <Avatar name={name} media={media} size={size} />;
  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen(true)}
        aria-label={t("profile.viewPhoto", { name })}
      >
        <Avatar name={name} media={media} size={size} />
      </button>
      <Lightbox images={[{ src, alt: name }]} index={open ? 0 : null} onClose={() => setOpen(false)} />
    </>
  );
}
