import type { Me } from "@/types/api";

import { http, request } from "./client";

export interface RegisterInput {
  age_confirmed: boolean;
  email: string;
  password: string;
  display_name: string;
  phone: string;
  phone_region?: string;
  city_id?: string | null;
}

export const authApi = {
  register: (input: RegisterInput) => http.post<Me>("/auth/register/", input),
  login: (email: string, password: string) =>
    request<Me>("/auth/login/", { method: "POST", body: { email, password }, skipRefresh: true }),
  logout: () => request<void>("/auth/logout/", { method: "POST", body: {}, skipRefresh: true }),
  verifyEmail: (token: string) =>
    request<{ verified: boolean }>("/auth/verify-email/", {
      method: "POST",
      body: { token },
      skipRefresh: true,
    }),
  resendVerification: () => http.post<void>("/auth/verify-email/resend/"),
  google: (input: { credential: string } | { code: string }) => http.post<Me>("/auth/google/", input),
  requestPasswordReset: (email: string) => http.post<void>("/auth/password-reset/", { email }),
  confirmPasswordReset: (uid: string, token: string, password: string) =>
    http.post<void>("/auth/password-reset/confirm/", { uid, token, password }),
};
