import type { AppNotification, Paginated } from "@/types/api";

import { http } from "./client";

export type NotificationsPage = Paginated<AppNotification> & { unread_count: number };

export const notificationsApi = {
  list: (page?: number) => http.get<NotificationsPage>("/notifications/", { page }),
  unreadCount: () => http.get<NotificationsPage>("/notifications/", { unread: 1, page_size: 1 }),
  read: (id: string, viaPush = false) =>
    http.post<AppNotification>(`/notifications/${id}/read/`, { via_push: viaPush }),
  readAll: () => http.post<void>("/notifications/read-all/"),
  subscribePush: (subscription: PushSubscriptionJSON) =>
    http.post<{ id: number }>("/push-subscriptions/", {
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    }),
  unsubscribePush: (id: number) => http.delete(`/push-subscriptions/${id}/`),
};
