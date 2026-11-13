import { useEffect, useState } from "react";

import type { ListSort } from "@/api/helpRequests";

/** Orders offered for one's own lists and for the neighbourhood feed. */
export const HISTORY_SORTS: ListSort[] = ["newest", "oldest", "urgency", "soon"];
export const NEARBY_SORTS: ListSort[] = ["distance", ...HISTORY_SORTS];

export interface ListFilter {
  q: string;
  sort: ListSort;
}

/** Search text and order for a request list; the text reaches the query only after a short pause. */
export function useListFilter(defaultSort: ListSort) {
  const [text, setText] = useState("");
  const [sort, setSort] = useState<ListSort>(defaultSort);
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(text.trim()), 300);
    return () => window.clearTimeout(id);
  }, [text]);
  return { text, setText, sort, setSort, q, active: q !== "" };
}
