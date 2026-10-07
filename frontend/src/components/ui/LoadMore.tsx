import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "./Button";

/**
 * End of an endless list: loads the next page by itself when scrolled into view, with a button
 * as a fallback (and for keyboard users). Renders nothing when there is no next page.
 */
export function LoadMore({
  hasNextPage,
  isFetching,
  onLoad,
}: {
  hasNextPage: boolean | undefined;
  isFetching: boolean;
  onLoad: () => void;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const load = useRef(onLoad);
  useEffect(() => {
    load.current = onLoad;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNextPage || isFetching || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && load.current(),
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching]);

  if (!hasNextPage) return null;
  return (
    <div ref={ref} style={{ display: "flex", justifyContent: "center" }}>
      <Button variant="ghost" size="sm" onClick={onLoad} loading={isFetching}>
        {t("nearby.loadMore")}
      </Button>
    </div>
  );
}
