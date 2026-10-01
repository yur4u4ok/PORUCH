import type {
  Category,
  GeoPosition,
  HelpRequest,
  HelpResponse,
  HelpRequestStatus,
  Paginated,
  RewardType,
  ThankYou,
  Urgency,
} from "@/types/api";

import { http } from "./client";

export interface NearbyQuery {
  lat: number;
  lng: number;
  radius: number;
  category?: Category[];
  urgency?: Urgency[];
  page?: number;
}

export interface HistoryQuery {
  role: "author" | "helper" | "responded";
  status?: HelpRequestStatus[];
  page?: number;
}

export interface CreateHelpRequestInput {
  category: Category;
  subcategory?: string | null;
  title?: string;
  description: string;
  location: GeoPosition;
  urgency: Urgency;
  reward_type: RewardType;
  reward_amount?: string | null;
  photo_ids?: string[];
  emergency_acknowledged?: boolean;
}

const csv = (values?: string[]) => (values && values.length ? values.join(",") : undefined);

export const helpRequestsApi = {
  nearby: ({ lat, lng, radius, category, urgency, page }: NearbyQuery, signal?: AbortSignal) =>
    http.get<Paginated<HelpRequest>>(
      "/help-requests/",
      { lat, lng, radius, category: csv(category), urgency: csv(urgency), page },
      signal,
    ),
  history: ({ role, status, page }: HistoryQuery, signal?: AbortSignal) =>
    http.get<Paginated<HelpRequest>>("/help-requests/", { role, status: csv(status), page }, signal),
  get: (id: string, position?: GeoPosition | null) =>
    http.get<HelpRequest>(
      `/help-requests/${id}/`,
      position ? { lat: position.latitude, lng: position.longitude } : undefined,
    ),
  create: (input: CreateHelpRequestInput) => http.post<HelpRequest>("/help-requests/", input),
  update: (
    id: string,
    input: Partial<
      Pick<CreateHelpRequestInput, "title" | "description" | "reward_type" | "reward_amount" | "photo_ids">
    >,
  ) => http.patch<HelpRequest>(`/help-requests/${id}/`, input),
  cancel: (id: string) => http.post<HelpRequest>(`/help-requests/${id}/cancel/`),
  complete: (id: string) => http.post<HelpRequest>(`/help-requests/${id}/complete/`),
  respond: (id: string, message = "") =>
    http.post<HelpResponse>(`/help-requests/${id}/respond/`, { message }),
  selectHelper: (id: string, responseId: string) =>
    http.post<HelpRequest>(`/help-requests/${id}/select-helper/`, { response_id: responseId }),
  responses: (id: string) => http.get<HelpResponse[]>(`/help-requests/${id}/responses/`),
  thankYou: (id: string, message: string) =>
    http.post<ThankYou>(`/help-requests/${id}/thank-you/`, { message }),
};
