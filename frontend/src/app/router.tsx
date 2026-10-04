/* eslint-disable react-refresh/only-export-components -- route table with lazy pages */
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation, useParams } from "react-router";

import { AppLayout } from "@/components/layout/AppLayout";
import { Loader } from "@/components/ui";
import { useMe } from "@/features/auth/hooks";

import { GuestOnly, RequireAuth } from "./guards";

// Route-level code splitting keeps the initial load small (LCP < 2.5s target).
const LandingPage = lazy(() => import("@/pages/Landing/LandingPage"));
const HomePage = lazy(() => import("@/pages/Home/HomePage"));
const NearbyPage = lazy(() => import("@/pages/Nearby/NearbyPage"));
const CreateHelpPage = lazy(() => import("@/pages/CreateHelp/CreateHelpPage"));
const HelpRequestPage = lazy(() => import("@/pages/HelpRequest/HelpRequestPage"));
const ConversationsPage = lazy(() => import("@/pages/Conversations/ConversationsPage"));
const ChatPage = lazy(() => import("@/pages/Chat/ChatPage"));
const ProfilePage = lazy(() => import("@/pages/Profile/ProfilePage"));
const PublicProfilePage = lazy(() => import("@/pages/Profile/PublicProfilePage"));
const NotificationsPage = lazy(() => import("@/pages/Notifications/NotificationsPage"));
const OnboardingPage = lazy(() => import("@/pages/Onboarding/OnboardingPage"));
const SharePage = lazy(() => import("@/pages/Share/SharePage"));
const NotFoundPage = lazy(() => import("@/pages/NotFound/NotFoundPage"));
const auth = () => import("@/pages/Auth/AuthPages");
const LoginPage = lazy(() => auth().then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => auth().then((m) => ({ default: m.RegisterPage })));
const VerifyEmailPage = lazy(() => auth().then((m) => ({ default: m.VerifyEmailPage })));
const VerifyPendingPage = lazy(() => auth().then((m) => ({ default: m.VerifyPendingPage })));
const ForgotPasswordPage = lazy(() => auth().then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => auth().then((m) => ({ default: m.ResetPasswordPage })));
const SupportPage = lazy(() => import("@/pages/Support/SupportPage"));
const settings = () => import("@/pages/Settings/SettingsPages");
const SettingsPage = lazy(() => settings().then((m) => ({ default: m.SettingsPage })));
const NotificationSettingsPage = lazy(() =>
  settings().then((m) => ({ default: m.NotificationSettingsPage })),
);
const PrivacySettingsPage = lazy(() => settings().then((m) => ({ default: m.PrivacySettingsPage })));

const page = (node: ReactNode) => <Suspense fallback={<Loader />}>{node}</Suspense>;

/** "/" shows the landing page to guests and the app to signed-in users. */
function RootGate() {
  const { data: me, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <Loader />;
  if (!me) {
    if (location.pathname === "/") return page(<LandingPage />);
    return <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <RequireAuth />;
}

/** Share links are served by the backend (Open Graph for messengers); if the app catches one
 * first (e.g. an installed service worker), go straight to the public share page. */
function ShortShareRedirect() {
  const { code } = useParams();
  return <Navigate to={`/share/${code}`} replace />;
}

function LegacyChatRedirect() {
  const { id } = useParams();
  return <Navigate to={`/chats/${id}`} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/auth/login",
    element: page(
      <GuestOnly>
        <LoginPage />
      </GuestOnly>,
    ),
  },
  {
    path: "/auth/register",
    element: page(
      <GuestOnly>
        <RegisterPage />
      </GuestOnly>,
    ),
  },
  { path: "/auth/forgot-password", element: page(<ForgotPasswordPage />) },
  { path: "/auth/reset-password", element: page(<ResetPasswordPage />) },
  { path: "/auth/verify-email", element: page(<VerifyEmailPage />) },
  // Public: shared request links work without an account.
  { path: "/share/:code", element: page(<SharePage />) },
  { path: "/r/:code", element: <ShortShareRedirect /> },
  {
    element: <RequireAuth allowUnverified allowOnboarding />,
    children: [{ path: "/auth/verify-pending", element: page(<VerifyPendingPage />) }],
  },
  {
    element: <RequireAuth allowOnboarding />,
    children: [{ path: "/onboarding", element: page(<OnboardingPage />) }],
  },
  {
    path: "/",
    element: <RootGate />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: page(<HomePage />) },
          { path: "nearby", element: page(<NearbyPage />) },
          { path: "help/create", element: page(<CreateHelpPage />) },
          { path: "help/:id", element: page(<HelpRequestPage />) },
          { path: "chats", element: page(<ConversationsPage />) },
          { path: "chats/:id", element: page(<ChatPage />) },
          { path: "chat/:id", element: <LegacyChatRedirect /> },
          { path: "profile", element: page(<ProfilePage />) },
          { path: "profile/:id", element: page(<PublicProfilePage />) },
          { path: "notifications", element: page(<NotificationsPage />) },
          { path: "settings", element: page(<SettingsPage />) },
          { path: "settings/notifications", element: page(<NotificationSettingsPage />) },
          { path: "settings/privacy", element: page(<PrivacySettingsPage />) },
          { path: "support", element: page(<SupportPage />) },
          { path: "*", element: page(<NotFoundPage />) },
        ],
      },
    ],
  },
]);
