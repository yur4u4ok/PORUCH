import type { Media, MediaKind } from "@/types/api";

import { ApiError, http } from "./client";

interface UploadUrlResponse {
  media_id: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
}

/**
 * Presigned upload flow: backend issues a presigned PUT → browser uploads directly to S3/R2
 * → backend validates the real MIME type, resizes and strips metadata on confirm.
 */
export const mediaApi = {
  async upload(file: File, kind: MediaKind): Promise<Media> {
    const { media_id, upload } = await http.post<UploadUrlResponse>("/media/upload-url/", {
      kind,
      content_type: file.type,
      size: file.size,
    });
    let res: Response;
    try {
      res = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });
    } catch {
      throw new ApiError(0, { code: "UPLOAD_FAILED", message: "Upload failed" });
    }
    if (!res.ok) throw new ApiError(res.status, { code: "UPLOAD_FAILED", message: "Upload failed" });
    return http.post<Media>("/media/confirm/", { media_id });
  },
  remove: (id: string) => http.delete(`/media/${id}/`),
};
