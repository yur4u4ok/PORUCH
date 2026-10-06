import { ApiError } from "@/api/client";

export function validateImageFile(file: File, allowed: string[], maxBytes: number): "type" | "size" | null {
  if (!allowed.includes(file.type)) return "type";
  if (file.size > maxBytes) return "size";
  return null;
}

/** i18n key + params explaining why an upload failed, so the user knows what to change. */
export function uploadErrorMessage(error: unknown, maxMb: number): [string, Record<string, unknown>?] {
  if (error instanceof ApiError) {
    if ("size" in error.details) return ["create.photoTooLarge", { mb: maxMb }];
    if (error.code === "INVALID_FILE") return ["create.photoWrongType"];
    if (error.code === "RATE_LIMITED") return ["errors.RATE_LIMITED"];
    if (error.status === 0 || error.code === "NETWORK_ERROR") return ["errors.NETWORK_ERROR"];
  }
  return ["create.photoUploadFailed"];
}
