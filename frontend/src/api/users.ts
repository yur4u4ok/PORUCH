import type {
  ISODateTime,
  Availability,
  Block,
  Capability,
  City,
  GeoPosition,
  Me,
  NotificationCategory,
  Paginated,
  Preferences,
  PublicConfig,
  PublicProfile,
  ThankYou,
} from "@/types/api";

import { http, request } from "./client";

export type SupportTopic = "QUESTION" | "BUG" | "IDEA" | "SAFETY" | "OTHER";

export interface MeUpdate {
  display_name?: string;
  avatar_id?: string | null;
  city_id?: string | null;
  show_name?: boolean;
  show_avatar?: boolean;
  onboarding_completed?: boolean;
  custom_items?: string[];
}

export interface PreferencesUpdate {
  notification_radius?: number;
  enabled_categories?: NotificationCategory[];
  push_enabled?: boolean;
  email_enabled?: boolean;
  muted_until?: ISODateTime | null;
  location?: GeoPosition;
}

export interface AvailabilityInput extends GeoPosition {
  radius: number;
  categories: NotificationCategory[];
  duration_minutes?: number;
}

export const usersApi = {
  config: () => http.get<PublicConfig>("/config/"),
  cities: () => http.get<City[]>("/cities/"),
  me: () => request<Me>("/me/"),
  updateMe: (input: MeUpdate) => http.patch<Me>("/me/", input),
  deactivate: () => http.post<void>("/me/deactivate/"),
  capabilities: () => http.get<Capability[]>("/capabilities/"),
  myCapabilities: () => http.get<Capability[]>("/me/capabilities/"),
  setMyCapabilities: (codes: string[]) => http.put<Capability[]>("/me/capabilities/", { codes }),
  preferences: () => http.get<Preferences>("/me/preferences/"),
  updatePreferences: (input: PreferencesUpdate) => http.patch<Preferences>("/me/preferences/", input),
  profile: (id: string) => http.get<PublicProfile>(`/users/${id}/`),
  thanks: (id: string) => http.get<Paginated<ThankYou>>(`/users/${id}/thanks/`),
  availability: () => http.get<Availability>("/availability/"),
  setAvailability: (input: AvailabilityInput) => http.post<Availability>("/availability/", input),
  clearAvailability: () => http.delete("/availability/"),
  blocks: () => http.get<Paginated<Block>>("/blocks/"),
  block: (userId: string) => http.post<Block>("/blocks/", { user_id: userId }),
  unblock: (userId: string) => http.delete(`/blocks/${userId}/`),
  report: (input: {
    reason: string;
    description?: string;
    target_user_id?: string;
    help_request_id?: string;
    message_id?: string;
  }) => http.post<{ id: string }>("/reports/", input),
  support: (input: { topic: SupportTopic; message: string; page?: string }) =>
    http.post<void>("/support/", input),
};
