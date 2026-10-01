import { z } from "zod";

import i18n from "@/i18n";

const t = (key: string, opts?: Record<string, unknown>) => i18n.t(key, opts);

export const loginSchema = z.object({
  email: z.string().trim().min(1, t("validation.required")).email(t("validation.email")),
  password: z.string().min(1, t("validation.required")),
});

export const registerSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, t("validation.required"))
    .max(50, t("validation.max", { max: 50 })),
  email: z.string().trim().min(1, t("validation.required")).email(t("validation.email")),
  password: z.string().min(8, t("validation.minPassword")).max(128),
});

export const emailSchema = z.object({
  email: z.string().trim().min(1, t("validation.required")).email(t("validation.email")),
});

export const passwordSchema = z.object({
  password: z.string().min(8, t("validation.minPassword")).max(128),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
