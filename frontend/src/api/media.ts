import type { Media, MediaKind } from "@/types/api";

import { ApiError, http } from "./client";

interface UploadUrlResponse {
  media_id: string;
  upload: { url: string; fields: Record<string, string> };
}

/**
 * Presigned upload flow: backend issues a presigned POST → browser uploads directly to S3
 * → backend validates the real MIME type, resizes and strips metadata on confirm.
 */
export const mediaApi = {
  async upload(file: File, kind: MediaKind): Promise<Media> {
    const { media_id, upload } = await http.post<UploadUrlResponse>("/media/upload-url/", {
      kind,
      content_type: file.type,
      size: file.size,
    });
    const form = new FormData();
    Object.entries(upload.fields).forEach(([key, value]) => form.append(key, value));
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(upload.url, { method: "POST", body: form });
    } catch {
      throw new ApiError(0, { code: "UPLOAD_FAILED", message: "Upload failed" });
    }
    if (!res.ok) throw new ApiError(res.status, { code: "UPLOAD_FAILED", message: "Upload failed" });
    return http.post<Media>("/media/confirm/", { media_id });
  },
  remove: (id: string) => http.delete(`/media/${id}/`),
};
