import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";

import { ErrorState, Loader } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";

export function RequireAuth({
  allowUnverified = false,
  allowOnboarding = false,
}: {
  allowUnverified?: boolean;
  allowOnboarding?: boolean;
}) {
  const { data: me, isPending, isError, refetch } = useMe();
  const location = useLocation();
  if (isPending) return <Loader />;
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (!me) return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />;
  if (!me.email_verified && !allowUnverified) return <Navigate to="/auth/verify-pending" replace />;
  if (me.email_verified && !me.onboarding_completed && !allowOnboarding) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { data: me, isPending } = useMe();
  if (isPending) return <Loader />;
  if (me) return <Navigate to="/" replace />;
  return <>{children}</>;
}
