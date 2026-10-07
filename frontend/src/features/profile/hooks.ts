import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { infiniteList } from "@/api/paging";

import { queryKeys } from "@/api/queryKeys";
import { usersApi, type AvailabilityInput, type MeUpdate, type PreferencesUpdate } from "@/api/users";
import type { ThankYou } from "@/types/api";

export function usePublicConfig() {
  return useQuery({ queryKey: queryKeys.config, queryFn: usersApi.config, staleTime: Infinity });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MeUpdate) => usersApi.updateMe(input),
    onSuccess: (me) => qc.setQueryData(queryKeys.me, me),
  });
}

export function useCapabilities() {
  return useQuery({ queryKey: queryKeys.capabilities, queryFn: usersApi.capabilities, staleTime: Infinity });
}

export function useMyCapabilities() {
  return useQuery({ queryKey: queryKeys.myCapabilities, queryFn: usersApi.myCapabilities });
}

export function useSetMyCapabilities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (codes: string[]) => usersApi.setMyCapabilities(codes),
    onSuccess: (caps) => qc.setQueryData(queryKeys.myCapabilities, caps),
  });
}

export function usePreferences() {
  return useQuery({ queryKey: queryKeys.preferences, queryFn: usersApi.preferences });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PreferencesUpdate) => usersApi.updatePreferences(input),
    onSuccess: (prefs) => qc.setQueryData(queryKeys.preferences, prefs),
  });
}

export function useAvailability() {
  return useQuery({
    queryKey: queryKeys.availability,
    queryFn: usersApi.availability,
    refetchInterval: 60_000,
  });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AvailabilityInput) => usersApi.setAvailability(input),
    onSuccess: (data) => qc.setQueryData(queryKeys.availability, data),
  });
}

export function useClearAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.clearAvailability(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.availability }),
  });
}

export function usePublicProfile(id: string) {
  return useQuery({ queryKey: queryKeys.profile(id), queryFn: () => usersApi.profile(id) });
}

export function useChangePassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.changePassword,
    onSuccess: (me) => qc.setQueryData(queryKeys.me, me),
    meta: { inlineErrors: true },
  });
}

export function useChangeEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.changeEmail,
    onSuccess: (me) => qc.setQueryData(queryKeys.me, me),
    meta: { inlineErrors: true },
  });
}

export function useThanks(id: string | undefined) {
  return useInfiniteQuery({
    queryKey: queryKeys.thanks(id ?? ""),
    ...infiniteList<ThankYou>(`/users/${id}/thanks/`),
    enabled: !!id,
  });
}

export function useBlocks() {
  return useQuery({ queryKey: queryKeys.blocks, queryFn: usersApi.blocks });
}

export function useBlockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersApi.block(userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.blocks });
      void qc.invalidateQueries({ queryKey: queryKeys.helpRequests });
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export function useUnblockUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersApi.unblock(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.blocks }),
  });
}

export function useReport() {
  return useMutation({ mutationFn: usersApi.report });
}

export function useDeactivate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => usersApi.deactivate(),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(queryKeys.me, null);
    },
  });
}
