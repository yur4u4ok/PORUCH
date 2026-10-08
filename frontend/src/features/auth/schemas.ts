/** Messages are i18n keys ("key" or "key|max"), translated at render via useFieldError(). */
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "validation.required").email("validation.email"),
  password: z.string().min(1, "validation.required"),
});

export const registerSchema = z.object({
  display_name: z.string().trim().min(1, "validation.required").max(50, "validation.max|50"),
  email: z.string().trim().min(1, "validation.required").email("validation.email"),
  password: z.string().min(8, "validation.minPassword").max(128),
  // Checked properly on the server (country rules); here only that it looks like a number.
  phone: z
    .string()
    .trim()
    .min(1, "validation.required")
    .regex(/^\+?[\d\s()-]{7,20}$/, "validation.phone"),
  // Terms of Service: at least 16 years old.
  age_confirmed: z.boolean().refine((v) => v, "auth.ageRequired"),
});

export const emailSchema = z.object({
  email: z.string().trim().min(1, "validation.required").email("validation.email"),
});

export const passwordSchema = z.object({
  password: z.string().min(8, "validation.minPassword").max(128),
});

export type LoginForm = z.infer<typeof loginSchema>;
export type RegisterForm = z.infer<typeof registerSchema>;
