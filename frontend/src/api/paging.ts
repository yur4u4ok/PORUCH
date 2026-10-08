import type { InfiniteData } from "@tanstack/react-query";

import type { Paginated } from "@/types/api";

import { http } from "./client";

/** Follows the server's own `next` link page by page (works for page numbers and cursors). */
export function infiniteList<T, P extends Paginated<T> = Paginated<T>>(firstUrl: string) {
  return {
    queryFn: ({ pageParam }: { pageParam: string | null }) => http.get<P>(pageParam ?? firstUrl),
    initialPageParam: null as string | null,
    // Keep only path + query: the absolute link may name an internal host behind the proxy.
    getNextPageParam: (last: P) => {
      if (!last.next) return undefined;
      const url = new URL(last.next, window.location.origin);
      return `${url.pathname}${url.search}`;
    },
  };
}

export const allResults = <T>(data: InfiniteData<Paginated<T>> | undefined): T[] =>
  data?.pages.flatMap((p) => p.results) ?? [];
