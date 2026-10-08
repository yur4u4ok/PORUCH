import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { http } from "@/api/client";
import { allResults, infiniteList } from "@/api/paging";
import { queryKeys } from "@/api/queryKeys";
import { Avatar, Button, Card, LoadMore, Modal, SkeletonList, Textarea } from "@/components/ui";
import { toast } from "@/stores/toastStore";
import type { HelpRequest, PublicUser, Review } from "@/types/api";
import { timeAgo } from "@/utils/format";

import styles from "./Reviews.module.css";

/** Read-only stars, e.g. ★★★★☆. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className={styles.stars} style={{ fontSize: size }} aria-label={`${value} / 5`}>
      {"★".repeat(full)}
      <span className={styles.starsOff}>{"★".repeat(5 - full)}</span>
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const { t } = useTranslation();
  return (
    <div className={styles.starInput} role="radiogroup" aria-label={t("reviews.rating")}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} / 5`}
          className={n <= value ? styles.starOn : styles.starOff}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function ReviewDialog({
  request,
  user,
  onClose,
}: {
  request: HelpRequest;
  user: PublicUser;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () =>
      http.post<Review>(`/help-requests/${request.id}/reviews/`, { to_user: user.id, rating, text }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.helpRequest(request.id) });
      void qc.invalidateQueries({ queryKey: queryKeys.reviews(user.id) });
      toast.success(t("reviews.sent"));
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t("reviews.title", { name: user.display_name ?? t("common.anonymous") })}
      actions={
        <Button disabled={!rating} loading={send.isPending} onClick={() => send.mutate()}>
          {t("reviews.submit")}
        </Button>
      }
    >
      <div className="stack-sm">
        <StarInput value={rating} onChange={setRating} />
        <Textarea
          value={text}
          maxLength={500}
          placeholder={t("reviews.placeholder")}
          onChange={(e) => setText(e.target.value)}
        />
        <p className="muted" style={{ fontSize: 13 }}>
          ℹ️ {t("reviews.permanent")}
        </p>
      </div>
    </Modal>
  );
}

/** After a completed request: rate each person you worked with (once, for good). */
export function LeaveReviews({ request }: { request: HelpRequest }) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<PublicUser | null>(null);
  const items = request.reviews_to_leave ?? [];
  if (!items.length) return null;
  return (
    <Card className="stack-sm">
      <h3>⭐ {t("reviews.leaveTitle")}</h3>
      {items.map(({ user, reviewed }) => {
        const name = user.display_name ?? t("common.anonymous");
        return (
          <div key={user.id} className="row-between">
            <span className="row">
              <Avatar name={name} media={user.avatar} size={32} />
              {name}
            </span>
            {reviewed ? (
              <span className="muted">✓ {t("reviews.done")}</span>
            ) : (
              <Button size="sm" onClick={() => setTarget(user)}>
                {t("reviews.leave")}
              </Button>
            )}
          </div>
        );
      })}
      {target && <ReviewDialog request={request} user={target} onClose={() => setTarget(null)} />}
    </Card>
  );
}

function useReviews(userId: string) {
  return useInfiniteQuery({
    queryKey: queryKeys.reviews(userId),
    ...infiniteList<Review>(`/users/${userId}/reviews/`),
  });
}

/** «4.8 ★ · 12 відгуків» next to the profile stats. */
export function RatingSummary({ user }: { user: { rating: number | null; reviews_count: number } }) {
  const { t } = useTranslation();
  if (!user.reviews_count || user.rating == null) return null;
  return (
    <span className={styles.summary}>
      <Stars value={user.rating} /> {user.rating.toFixed(1)} ·{" "}
      {t("reviews.count", { count: user.reviews_count })}
    </span>
  );
}

export function ReviewsList({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const reviews = useReviews(userId);
  const items = allResults(reviews.data);
  return (
    <section className="stack-sm">
      <h2>{t("reviews.heading")}</h2>
      {reviews.isPending ? (
        <SkeletonList count={1} height={64} />
      ) : items.length === 0 ? (
        <p className="muted">{t("reviews.none")}</p>
      ) : (
        items.map((review) => (
          <Card key={review.id} className="stack-sm">
            <Stars value={review.rating} />
            {review.text && <p>{review.text}</p>}
            <span className="muted" style={{ fontSize: 13 }}>
              {review.from_user.display_name ?? t("common.anonymous")} · {review.help_request.title} ·{" "}
              {timeAgo(review.created_at)}
            </span>
          </Card>
        ))
      )}
      <LoadMore
        hasNextPage={reviews.hasNextPage}
        isFetching={reviews.isFetchingNextPage}
        onLoad={() => void reviews.fetchNextPage()}
      />
    </section>
  );
}
