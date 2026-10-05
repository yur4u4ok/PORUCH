import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  helpRequestsApi,
  type CreateHelpRequestInput,
  type RespondInput,
  type HistoryQuery,
  type NearbyQuery,
} from "@/api/helpRequests";
import { queryKeys } from "@/api/queryKeys";
import { responsesApi } from "@/api/responses";
import type { GeoPosition, HelpRequest } from "@/types/api";

function nextPage(next: string | null): number | undefined {
  if (!next) return undefined;
  const page = new URL(next, window.location.origin).searchParams.get("page");
  return page ? Number(page) : undefined;
}

export function useHelpRequests(query: Omit<NearbyQuery, "page"> | null) {
  return useInfiniteQuery({
    queryKey: queryKeys.nearby(query ?? { lat: 0, lng: 0, radius: 0 }),
    queryFn: ({ pageParam, signal }) => helpRequestsApi.nearby({ ...query!, page: pageParam }, signal),
    initialPageParam: 1 as number | undefined,
    getNextPageParam: (last) => nextPage(last.next),
    enabled: !!query,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useHelpHistory(query: Omit<HistoryQuery, "page">, enabled = true) {
  return useInfiniteQuery({
    queryKey: queryKeys.history(query),
    queryFn: ({ pageParam, signal }) => helpRequestsApi.history({ ...query, page: pageParam }, signal),
    initialPageParam: 1 as number | undefined,
    getNextPageParam: (last) => nextPage(last.next),
    enabled,
  });
}

export function useHelpRequest(id: string, position?: GeoPosition | null) {
  return useQuery({
    queryKey: queryKeys.helpRequest(id),
    queryFn: () => helpRequestsApi.get(id, position),
    refetchInterval: 30_000,
  });
}

export function useHelpResponses(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.responses(id),
    queryFn: () => helpRequestsApi.responses(id),
    enabled,
    refetchInterval: enabled ? 20_000 : false,
  });
}

export function useCreateHelpRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHelpRequestInput) => helpRequestsApi.create(input),
    onSuccess: (created) => {
      qc.setQueryData(queryKeys.helpRequest(created.id), created);
      void qc.invalidateQueries({ queryKey: queryKeys.helpRequests });
    },
    meta: { inlineErrors: true },
  });
}

/** Shared invalidation after any state change on a request. */
function useRequestMutation<TVars>(id: string, fn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      if (data && typeof data === "object" && "status" in data && "author" in data) {
        qc.setQueryData(queryKeys.helpRequest(id), data as HelpRequest);
      }
      void qc.invalidateQueries({ queryKey: queryKeys.helpRequest(id) });
      void qc.invalidateQueries({ queryKey: ["help-requests", "history"] });
      void qc.invalidateQueries({ queryKey: queryKeys.conversations });
    },
  });
}

export const useRespondToHelp = (id: string) =>
  useRequestMutation(id, (input: RespondInput) => helpRequestsApi.respond(id, input));
export const useCancelHelpRequest = (id: string) => useRequestMutation(id, () => helpRequestsApi.cancel(id));
export const useCompleteHelpRequest = (id: string) =>
  useRequestMutation(id, () => helpRequestsApi.complete(id));
export const useSelectHelper = (id: string) =>
  useRequestMutation(id, (responseId: string) => helpRequestsApi.selectHelper(id, responseId));
export const useRejectResponse = (id: string) =>
  useRequestMutation(id, (responseId: string) => responsesApi.reject(responseId));
export const useWithdrawResponse = (id: string) =>
  useRequestMutation(id, (responseId: string) => responsesApi.cancel(responseId));
export const useThankHelper = (id: string) =>
  useRequestMutation(id, (message: string) => helpRequestsApi.thankYou(id, message));
