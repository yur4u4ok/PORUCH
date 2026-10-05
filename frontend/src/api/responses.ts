import type { HelpResponse } from "@/types/api";

import { http } from "./client";

export const responsesApi = {
  get: (id: string) => http.get<HelpResponse>(`/help-responses/${id}/`),
  accept: (id: string) => http.post<HelpResponse>(`/help-responses/${id}/accept/`),
  reject: (id: string) => http.post<HelpResponse>(`/help-responses/${id}/reject/`),
  cancel: (id: string) => http.post<HelpResponse>(`/help-responses/${id}/cancel/`),
};
