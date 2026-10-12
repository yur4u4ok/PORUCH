import { keepPreviousData, useQuery, type QueryKey } from "@tanstack/react-query";
import { useState } from "react";

import type { Paginated } from "@/types/api";

/** How many items a paged block shows at once (home lists, profile history, reviews/thanks). */
export const PAGE_SIZE = 5;

/**
 * One page of a server list at a time (page numbers, PAGE_SIZE per page). The previous page stays
 * on screen while the next one loads, so the block never flashes empty.
 */
export function usePagedList<T>(
  key: QueryKey,
  fetchPage: (page: number, signal: AbortSignal) => Promise<Paginated<T>>,
  enabled = true,
  refetchInterval: number | false = false,
) {
  // Page is remembered per list key, so changing filters starts again from page 1.
  const keyId = JSON.stringify(key);
  const [state, setState] = useState({ keyId, page: 1 });
  const page = state.keyId === keyId ? state.page : 1;
  const setPage = (next: number) => setState({ keyId, page: next });
  const query = useQuery({
    queryKey: [...key, "paged", PAGE_SIZE, page],
    queryFn: ({ signal }) => fetchPage(page, signal),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval,
  });
  const count = query.data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  return {
    items: query.data?.results ?? [],
    count,
    page: Math.min(page, pages),
    pages,
    setPage,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
}
