import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { usePublicConfig } from "@/features/profile/hooks";

import styles from "./GoogleButton.module.css";
import { useGoogleLogin } from "./hooks";

const GIS_SRC = "https://accounts.google.com/gsi/client";

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

function loadScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("gis"));
    if (!existing) document.head.appendChild(script);
  });
}

/** Google Identity Services button; rendered only when GOOGLE_CLIENT_ID is configured. */
export function GoogleButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const { data: config } = usePublicConfig();
  const { t, i18n } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const login = useGoogleLogin();
  const navigate = useNavigate();
  const clientId = config?.google_client_id;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.google || !ref.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) =>
            login.mutate(credential, { onSuccess: () => navigate(redirectTo, { replace: true }) }),
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: "outline",
          size: "large",
          // Invisible click target over our own button: as wide as it (GIS caps at 400 px).
          width: Math.min(400, Math.round(ref.current.parentElement?.clientWidth ?? 320)),
          locale: i18n.language,
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;
  // Google renders its own iframe button that can't take our radius, so we show a native-looking
  // button and lay Google's (transparent, still the real click target) on top of it.
  return (
    <div className={styles.wrap}>
      <span className={styles.face} aria-hidden>
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path
            fill="#EA4335"
            d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z"
          />
          <path
            fill="#FBBC05"
            d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z"
          />
        </svg>
        {t("auth.google")}
      </span>
      <div ref={ref} className={styles.gis} />
    </div>
  );
}
