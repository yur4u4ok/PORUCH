import { http } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { PAGE_SIZE, usePagedList } from "@/hooks/usePagedList";
import type { Paginated, Review, ThankYou } from "@/types/api";

const fetcher =
  <T>(path: string) =>
  (page: number, signal: AbortSignal) =>
    http.get<Paginated<T>>(path, { page, page_size: PAGE_SIZE }, signal);

/** Paged «Відгуки» and «Подяки» a person received. */
export function useFeedback(userId: string) {
  const reviews = usePagedList(queryKeys.reviews(userId), fetcher<Review>(`/users/${userId}/reviews/`));
  const thanks = usePagedList(queryKeys.thanks(userId), fetcher<ThankYou>(`/users/${userId}/thanks/`));
  return { reviews, thanks };
}
