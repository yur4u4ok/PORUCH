import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { authApi, type RegisterInput } from "@/api/auth";
import { ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { usersApi } from "@/api/users";
import { disablePushOnThisDevice } from "@/features/notifications/push";
import type { Me } from "@/types/api";

/** Current user or null when anonymous. */
export function useMe() {
  return useQuery<Me | null>({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await usersApi.me();
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return null;
        throw error;
      }
    },
    staleTime: 5 * 60_000,
    meta: { silent: true },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.login(email, password),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, me);
    },
    meta: { inlineErrors: true },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => authApi.register(input),
    onSuccess: (me) => qc.setQueryData(queryKeys.me, me),
    meta: { inlineErrors: true },
  });
}

export function useGoogleLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => authApi.google({ code }),
    onSuccess: (me) => {
      qc.clear();
      qc.setQueryData(queryKeys.me, me);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await disablePushOnThisDevice().catch(() => undefined);
      await authApi.logout();
    },
    onSettled: () => {
      qc.clear();
      qc.setQueryData(queryKeys.me, null);
    },
  });
}
