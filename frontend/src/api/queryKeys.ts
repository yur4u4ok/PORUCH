import type { HistoryQuery, NearbyQuery } from "./helpRequests";

export const queryKeys = {
  me: ["me"] as const,
  config: ["config"] as const,
  cities: ["cities"] as const,
  preferences: ["preferences"] as const,
  availability: ["availability"] as const,
  capabilities: ["capabilities"] as const,
  myCapabilities: ["me", "capabilities"] as const,
  profile: (id: string) => ["users", id] as const,
  thanks: (id: string) => ["users", id, "thanks"] as const,
  blocks: ["blocks"] as const,
  helpRequests: ["help-requests"] as const,
  nearby: (q: Omit<NearbyQuery, "page">) => ["help-requests", "nearby", q] as const,
  history: (q: Omit<HistoryQuery, "page">) => ["help-requests", "history", q] as const,
  helpRequest: (id: string) => ["help-requests", "detail", id] as const,
  responses: (id: string) => ["help-requests", "detail", id, "responses"] as const,
  conversations: ["conversations"] as const,
  conversation: (id: string) => ["conversations", id] as const,
  messages: (id: string) => ["conversations", id, "messages"] as const,
  notifications: ["notifications"] as const,
  unread: ["notifications", "unread"] as const,
};
