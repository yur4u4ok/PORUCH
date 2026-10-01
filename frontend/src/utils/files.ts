export function validateImageFile(file: File, allowed: string[], maxBytes: number): "type" | "size" | null {
  if (!allowed.includes(file.type)) return "type";
  if (file.size > maxBytes) return "size";
  return null;
}
