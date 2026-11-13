import { API_BASE } from "@/api/client";

/** Funnel events the backend accepts (see common/views.py CLIENT_EVENTS). Never send personal data. */
export type ClientEvent =
  "landing_view" | "signup_started" | "login_started" | "create_request_clicked" | "nearby_requests_clicked";

export type ClientEventOrigin = "landing" | "home" | "auth" | "share";

/** Fire-and-forget: analytics must never block or break navigation. */
export function track(event: ClientEvent, origin?: ClientEventOrigin): void {
  try {
    void fetch(`${API_BASE}/events/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(origin ? { event, origin } : { event }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
