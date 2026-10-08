import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { RouterProvider } from "react-router";

import { onUnauthorized } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { Toaster } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";
import { usePlace } from "@/features/location/place";
import { enablePush, pushSupport, syncPushSubscription } from "@/features/notifications/push";

import { UpdatePrompt } from "./pwa";
import { createQueryClient } from "./queryClient";
import { router } from "./router";

const ASKED_KEY = "poruch.pushAsked";

function SessionEffects() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  usePlace(); // detects the real location → regional formats and fallback map centre

  useEffect(() => onUnauthorized(() => qc.setQueryData(queryKeys.me, null)), [qc]);

  // Keep this device's push subscription registered for the signed-in user.
  useEffect(() => {
    if (me?.email_verified) void syncPushSubscription().catch(() => undefined);
  }, [me?.id, me?.email_verified]);

  // Push is on by default: browsers only show the permission question after a tap, so the first
  // tap in the app (once per device) asks. A «no» is respected and never asked again.
  useEffect(() => {
    if (!me?.email_verified || pushSupport() !== "supported" || Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(ASKED_KEY)) return;
    } catch {
      return;
    }
    const ask = () => {
      try {
        localStorage.setItem(ASKED_KEY, "1");
      } catch {
        /* ignore */
      }
      void enablePush().catch(() => undefined);
    };
    document.addEventListener("click", ask, { once: true, capture: true });
    return () => document.removeEventListener("click", ask, { capture: true });
  }, [me?.id, me?.email_verified]);

  return null;
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <SessionEffects />
      <RouterProvider router={router} />
      <Toaster />
      <UpdatePrompt />
    </QueryClientProvider>
  );
}
