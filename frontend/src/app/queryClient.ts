import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/api/client";
import i18n from "@/i18n";
import { toast } from "@/stores/toastStore";

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    if (i18n.exists(key)) return i18n.t(key);
    return error.message || i18n.t("common.error");
  }
  return i18n.t("common.error");
}

/** Global API error handling: transient errors → toast; forms show inline errors themselves. */
export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.silent) return;
        if (
          error instanceof ApiError &&
          (error.status === 0 || error.status === 429 || error.status >= 500)
        ) {
          toast.error(errorMessage(error));
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.inlineErrors) return;
        toast.error(errorMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (count, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: { silent?: boolean };
    mutationMeta: { inlineErrors?: boolean };
  }
}
