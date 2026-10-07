import type { HelpResponse } from "@/types/api";

import { http } from "./client";

export const responsesApi = {
  get: (id: string) => http.get<HelpResponse>(`/help-responses/${id}/`),
  accept: (id: string) => http.post<HelpResponse>(`/help-responses/${id}/accept/`),
  reject: (id: string) => http.post<HelpResponse>(`/help-responses/${id}/reject/`),
  cancel: (id: string) => http.post<HelpResponse>(`/help-responses/${id}/cancel/`),
  /** Author: answer a helper's different amount with one amount of their own. */
  counter: (id: string, amount: string) =>
    http.post<HelpResponse>(`/help-responses/${id}/counter/`, { amount }),
  /** Helper: accept (and be chosen) or decline the author's amount. */
  answerCounter: (id: string, accept: boolean) =>
    http.post<HelpResponse>(`/help-responses/${id}/counter-answer/`, { accept }),
};
