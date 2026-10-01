import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { notificationsApi } from "@/api/notifications";
import { queryKeys } from "@/api/queryKeys";

export function useNotifications(enabled = true) {
  return useQuery({ queryKey: queryKeys.notifications, queryFn: () => notificationsApi.list(), enabled });
}

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.unread,
    queryFn: () => notificationsApi.unreadCount(),
    select: (data) => data.unread_count,
    enabled,
    refetchInterval: 60_000,
    meta: { silent: true },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, viaPush }: { id: string; viaPush?: boolean }) => notificationsApi.read(id, viaPush),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
    meta: { inlineErrors: true },
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
