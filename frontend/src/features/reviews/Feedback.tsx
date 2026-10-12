import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Card, PagedBlock, SkeletonList, Switcher } from "@/components/ui";
import { timeAgo } from "@/utils/format";

import { Stars } from "./Reviews";
import { useFeedback } from "./useFeedback";

/** One page of reviews or thanks as cards. */
export function FeedbackCards({
  tab,
  feedback,
}: {
  tab: "reviews" | "thanks";
  feedback: ReturnType<typeof useFeedback>;
}) {
  const { t } = useTranslation();
  return tab === "reviews"
    ? feedback.reviews.items.map((review) => (
        <Card key={review.id} className="stack-sm">
          <Stars value={review.rating} />
          {review.text && <p>{review.text}</p>}
          <span className="muted" style={{ fontSize: 13 }}>
            {review.from_user.display_name ?? t("common.anonymous")} · {review.help_request.title} ·{" "}
            {timeAgo(review.created_at)}
          </span>
        </Card>
      ))
    : feedback.thanks.items.map((thank) => (
        <Card key={thank.id} className="stack-sm">
          <p>❤️ {thank.message || t("thanks.placeholder")}</p>
          <span className="muted" style={{ fontSize: 13 }}>
            {thank.from_user.display_name ?? t("common.anonymous")} · {thank.help_request.title} ·{" "}
            {timeAgo(thank.created_at)}
          </span>
        </Card>
      ));
}

/** «Відгуки» and «Подяки» a person received, behind one switch, 5 per page. Read-only. */
export function FeedbackSection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const [picked, setPicked] = useState<"reviews" | "thanks" | null>(null);
  const feedback = useFeedback(userId);
  const { reviews, thanks } = feedback;
  const tab = picked ?? (reviews.count === 0 && thanks.count > 0 ? "thanks" : "reviews");
  const list = tab === "reviews" ? reviews : thanks;
  return (
    <section className="stack-sm">
      <Switcher
        label={t("reviews.heading")}
        value={tab}
        onChange={setPicked}
        options={[
          { value: "reviews", label: t("reviews.heading"), count: reviews.count },
          { value: "thanks", label: t("profile.receivedThanks"), count: thanks.count },
        ]}
      >
        {list.isPending ? (
          <SkeletonList count={1} height={64} />
        ) : list.items.length === 0 ? (
          <p className="muted">{t(tab === "reviews" ? "reviews.none" : "profile.noThanks")}</p>
        ) : (
          <PagedBlock
            key={tab}
            page={list.page}
            pages={list.pages}
            onPage={list.setPage}
            busy={list.isFetching}
          >
            <FeedbackCards tab={tab} feedback={feedback} />
          </PagedBlock>
        )}
      </Switcher>
    </section>
  );
}
