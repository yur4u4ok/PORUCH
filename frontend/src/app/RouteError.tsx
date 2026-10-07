import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouteError } from "react-router";

import { Button, Loader } from "@/components/ui";

const RELOAD_KEY = "poruch.chunkReloadAt";

/** A JS chunk from an older deploy is gone (page opened before the update). */
function isStaleChunk(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|ChunkLoadError|Loading (CSS )?chunk/i.test(
    text,
  );
}

function reloadedRecently(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOAD_KEY) ?? 0) < 10_000;
  } catch {
    return false;
  }
}

/**
 * Error screen for every route. After a deploy an already-open page may request chunks that no
 * longer exist: reload once to get the new version. Anything else gets a plain, translated message.
 */
export function RouteError() {
  const error = useRouteError();
  const { t } = useTranslation();
  const stale = isStaleChunk(error) && !reloadedRecently();

  useEffect(() => {
    if (!stale) return;
    try {
      sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
    } catch {
      /* storage unavailable */
    }
    window.location.reload();
  }, [stale]);

  if (stale) return <Loader />;
  return (
    <main className="page stack" style={{ textAlign: "center", paddingTop: 64 }}>
      <h1 style={{ fontSize: 22 }}>{t("common.error")}</h1>
      <p className="muted">{t("app.updateHint")}</p>
      <Button onClick={() => window.location.reload()}>{t("app.reload")}</Button>
    </main>
  );
}
