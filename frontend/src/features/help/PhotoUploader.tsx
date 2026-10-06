import { useState } from "react";
import { useTranslation } from "react-i18next";

import { mediaApi } from "@/api/media";
import { usePublicConfig } from "@/features/profile/hooks";
import { toast } from "@/stores/toastStore";
import type { Media, MediaKind } from "@/types/api";

import { uploadErrorMessage, validateImageFile } from "@/utils/files";

import styles from "./PhotoUploader.module.css";

const DEFAULT_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoUploader({
  value,
  onChange,
  kind = "HELP_REQUEST",
  max,
}: {
  value: Media[];
  onChange: (media: Media[]) => void;
  kind?: MediaKind;
  max?: number;
}) {
  const { t } = useTranslation();
  const { data: config } = usePublicConfig();
  const [uploading, setUploading] = useState(0);
  const limit = max ?? config?.max_photos ?? 5;
  const maxBytes = config?.max_upload_bytes ?? 10 * 1024 * 1024;
  const allowed = config?.allowed_image_types ?? DEFAULT_TYPES;
  const mb = Math.round(maxBytes / 1024 / 1024);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = limit - value.length - uploading;
    const selected = Array.from(files).slice(0, Math.max(0, room));
    let next = [...value];
    for (const file of selected) {
      const problem = validateImageFile(file, allowed, maxBytes);
      if (problem) {
        toast.error(problem === "type" ? t("create.photoWrongType") : t("create.photoTooLarge", { mb }));
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const media = await mediaApi.upload(file, kind);
        next = [...next, media];
        onChange(next);
      } catch (error) {
        const [key, params] = uploadErrorMessage(error, mb);
        toast.error(t(key, params));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  return (
    <div className="stack-sm">
      <p className="muted">{t("create.photosHint", { max: limit, mb })}</p>
      <div className={styles.grid}>
        {value.map((media) => (
          <div key={media.id} className={styles.item}>
            {media.thumbnail_url && <img src={media.thumbnail_url} alt="" />}
            <button
              type="button"
              className={styles.remove}
              aria-label={t("common.delete")}
              onClick={() => onChange(value.filter((m) => m.id !== media.id))}
            >
              ✕
            </button>
          </div>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <div key={`u${i}`} className={styles.item}>
            <span className={styles.uploading}>{t("create.uploading")}</span>
          </div>
        ))}
        {value.length + uploading < limit && (
          <label className={styles.add}>
            <span aria-hidden>📷</span>
            {t("create.addPhoto")}
            <input
              type="file"
              accept={allowed.join(",")}
              multiple
              className="visually-hidden"
              onChange={(e) => {
                void onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
