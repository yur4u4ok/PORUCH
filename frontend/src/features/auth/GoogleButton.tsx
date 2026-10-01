import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";

import { usePublicConfig } from "@/features/profile/hooks";

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
          width: 320,
          locale: "uk",
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  if (!clientId) return null;
  return <div ref={ref} style={{ display: "flex", justifyContent: "center", minHeight: 44 }} />;
}
