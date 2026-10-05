import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { usePublicConfig } from "@/features/profile/hooks";

import styles from "./GoogleButton.module.css";
import { useGoogleLogin } from "./hooks";

const GIS_SRC = "https://accounts.google.com/gsi/client";

interface CodeClient {
  requestCode: () => void;
}

interface GoogleIdentity {
  accounts: {
    oauth2: {
      initCodeClient: (options: {
        client_id: string;
        scope: string;
        ux_mode: "popup";
        callback: (response: { code?: string; error?: string }) => void;
      }) => CodeClient;
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

/**
 * Our own button (same look as the rest of the app) that opens Google's account popup.
 * Google returns a one-time code; the backend exchanges it and verifies the ID token.
 * Rendered only when GOOGLE_CLIENT_ID is configured.
 */
export function GoogleButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const { data: config } = usePublicConfig();
  const { t } = useTranslation();
  const login = useGoogleLogin();
  const navigate = useNavigate();
  const clientId = config?.google_client_id;
  const [client, setClient] = useState<CodeClient | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.google) return;
        setClient(
          window.google.accounts.oauth2.initCodeClient({
            client_id: clientId,
            scope: "openid email profile",
            ux_mode: "popup",
            callback: ({ code }) => {
              if (code) login.mutate(code, { onSuccess: () => navigate(redirectTo, { replace: true }) });
            },
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;
  return (
    <button
      type="button"
      className={styles.button}
      onClick={() => client?.requestCode()}
      disabled={!client || login.isPending}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
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
    </button>
  );
}
