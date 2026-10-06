export type UUID = string;
export type ISODateTime = string;

export type Category = "AUTO" | "HOME" | "ITEMS" | "ANIMALS" | "PEOPLE" | "DISTRICT" | "URGENT" | "OTHER";
export type NotificationCategory = Exclude<Category, "OTHER">;
export type Urgency = "NOW" | "TODAY" | "WHENEVER" | "SCHEDULED";
export type RewardType = "NONE" | "WILLING" | "UNSURE";
export type RewardOption = "PIZZA" | "COFFEE" | "RETURN_HELP" | "GIVE_ITEM";
export type OfferType = "ACCEPT" | "COUNTER" | "FREE";
export type HelpRequestStatus = "ACTIVE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "EXPIRED";
export type ResponseStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
export type MessageType = "TEXT" | "IMAGE" | "SYSTEM";
export type ReportReason = "SPAM" | "FRAUD" | "HARASSMENT" | "DANGEROUS" | "INAPPROPRIATE" | "OTHER";
export type MediaKind = "AVATAR" | "HELP_REQUEST" | "CHAT";

export interface Paginated<T> {
  count?: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details: Record<string, unknown>;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface GeoPosition extends LatLng {
  accuracy?: number | null;
}

export interface Media {
  id: UUID;
  url: string | null;
  thumbnail_url: string | null;
  width: number | null;
  height: number | null;
  status: "PENDING" | "READY" | "FAILED";
}

export interface City {
  id: UUID;
  name: string;
  translations: Record<string, string>;
  slug: string;
  country_code: string;
  center: LatLng;
  default_zoom: number;
  is_default: boolean;
}

export interface Capability {
  code: string;
  kind: "HELP" | "ITEM";
  category: Category;
  emoji: string;
}

export interface PublicUser {
  id: UUID;
  display_name: string | null;
  avatar: Media | null;
  helped_count: number;
  thanks_received_count: number;
  member_since: ISODateTime;
  is_verified: boolean;
  is_active: boolean;
}

export interface PublicProfile extends PublicUser {
  capabilities: Capability[];
  custom_items: string[];
}

export interface Me {
  id: UUID;
  email: string;
  email_verified: boolean;
  date_joined: ISODateTime;
  display_name: string;
  avatar: Media | null;
  city: City | null;
  show_name: boolean;
  show_avatar: boolean;
  onboarding_completed: boolean;
  custom_items: string[];
  helped_count: number;
  thanks_received_count: number;
  has_password: boolean;
}

export interface Preferences {
  notification_radius: number;
  enabled_categories: NotificationCategory[];
  push_enabled: boolean;
  email_enabled: boolean;
  has_location: boolean;
  location_updated_at: ISODateTime | null;
}

export interface Availability {
  active: boolean;
  radius: number | null;
  categories: NotificationCategory[];
  expires_at: ISODateTime | null;
}

export interface PublicConfig {
  vapid_public_key: string;
  google_client_id: string;
  categories: Category[];
  subcategories: Record<Category, string[]>;
  notification_categories: NotificationCategory[];
  urgencies: Urgency[];
  radii: number[];
  default_radius: number;
  max_photos: number;
  max_upload_bytes: number;
  allowed_image_types: string[];
  availability_default_minutes: number;
  capabilities: Capability[];
}

export interface ResponseBrief {
  id: UUID;
  status: ResponseStatus;
  created_at: ISODateTime;
}

export interface HelpRequest {
  id: UUID;
  category: Category;
  subcategory: string | null;
  title: string;
  description: string;
  place_name: string;
  urgency: Urgency;
  /** When help is needed (urgency SCHEDULED). */
  needed_at: ISODateTime | null;
  reward_type: RewardType;
  reward_amount: string | null;
  reward_currency: string;
  reward_options: RewardOption[];
  agreed_offer_type: OfferType | null;
  agreed_amount: string | null;
  status: HelpRequestStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
  expires_at: ISODateTime;
  completed_at: ISODateTime | null;
  author: PublicUser;
  photos: Media[];
  distance_m: number | null;
  location: LatLng & { approximate: boolean };
  is_author: boolean;
  my_response: ResponseBrief | null;
  responses_count: number;
  selected_helper: PublicUser | null;
  conversation_id: UUID | null;
  can_respond: boolean;
  thanked: boolean | null;
  share_url: string | null;
}

export interface HelpResponse {
  id: UUID;
  help_request_id: UUID;
  helper: PublicUser;
  message: string;
  offer_type: OfferType;
  offered_amount: string | null;
  status: ResponseStatus;
  created_at: ISODateTime;
}

export interface Message {
  id: UUID;
  conversation_id: UUID;
  sender_id: UUID | null;
  text: string;
  message_type: MessageType;
  attachment: Media | null;
  client_id: UUID | null;
  created_at: ISODateTime;
  read_at: ISODateTime | null;
  /** client-only optimistic state */
  pending?: boolean;
  failed?: boolean;
}

export interface Conversation {
  id: UUID;
  help_request: { id: UUID; title: string; category: Category; status: HelpRequestStatus; author_id: UUID };
  other_participant: PublicUser | null;
  last_message: Message | null;
  unread_count: number;
  is_open: boolean;
  created_at: ISODateTime;
  last_message_at: ISODateTime | null;
}

export type NotificationType =
  | "NEW_NEARBY_REQUEST"
  | "HELP_RESPONSE_RECEIVED"
  | "HELP_RESPONSE_ACCEPTED"
  | "HELP_RESPONSE_REJECTED"
  | "NEW_MESSAGE"
  | "REQUEST_COMPLETED"
  | "THANK_YOU_RECEIVED"
  | "REQUEST_EXPIRING"
  | "REQUEST_CANCELLED";

export interface AppNotification {
  id: UUID;
  type: NotificationType;
  title: string;
  body: string;
  url: string;
  data: Record<string, unknown>;
  created_at: ISODateTime;
  read_at: ISODateTime | null;
  is_read: boolean;
}

export interface ThankYou {
  id: UUID;
  from_user: PublicUser;
  message: string;
  help_request: { id: UUID; title: string; category: Category };
  created_at: ISODateTime;
}

export interface Block {
  user: PublicUser;
  created_at: ISODateTime;
}

export interface SharePreview {
  id: UUID;
  active: boolean;
  status: HelpRequestStatus;
  category: Category | null;
  subcategory: string | null;
  title: string | null;
  description: string | null;
  urgency: Urgency | null;
  needed_at: ISODateTime | null;
  reward_type: RewardType | null;
  reward_amount: string | null;
  reward_currency: string;
  reward_options: RewardOption[];
  place: string;
  created_at: ISODateTime;
  expires_at: ISODateTime;
}
