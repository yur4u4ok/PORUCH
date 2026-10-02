/** Messages are i18n keys ("key" or "key|max"), translated at render via useFieldError(). */
import { z } from "zod";

export const createHelpSchema = z
  .object({
    category: z.enum(["AUTO", "HOME", "ITEMS", "ANIMALS", "PEOPLE", "DISTRICT", "URGENT", "OTHER"], {
      message: "validation.required",
    }),
    subcategory: z.string().nullable(),
    title: z.string().max(120, "validation.max|120"),
    description: z.string().trim().min(1, "validation.required").max(1000, "validation.max|1000"),
    location: z
      .object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().nullable().optional() })
      .nullable(),
    urgency: z.enum(["NOW", "TODAY", "WHENEVER"]),
    reward_type: z.enum(["NONE", "WILLING", "UNSURE"]),
    reward_amount: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{1,8}([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) >= 0), {
        message: "validation.amount",
      }),
    emergency_acknowledged: z.boolean(),
  })
  .refine((v) => v.location !== null, { path: ["location"], message: "create.locationError" })
  .refine((v) => v.reward_type !== "WILLING" || Number(v.reward_amount.replace(",", ".")) > 0, {
    path: ["reward_amount"],
    message: "reward.amountRequired",
  });

export type CreateHelpForm = z.infer<typeof createHelpSchema>;

export const STEP_FIELDS: (keyof CreateHelpForm)[][] = [
  ["category"],
  ["title", "description"],
  ["location"],
  ["urgency"],
  ["reward_type", "reward_amount"],
  [],
  [],
];
