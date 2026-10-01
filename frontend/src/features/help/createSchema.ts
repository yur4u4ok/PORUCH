import { z } from "zod";

import i18n from "@/i18n";

export const createHelpSchema = z
  .object({
    category: z.enum(["AUTO", "HOME", "ITEMS", "ANIMALS", "PEOPLE", "DISTRICT", "URGENT", "OTHER"], {
      message: i18n.t("validation.required"),
    }),
    subcategory: z.string().nullable(),
    title: z.string().max(120, i18n.t("validation.max", { max: 120 })),
    description: z
      .string()
      .trim()
      .min(1, i18n.t("validation.required"))
      .max(1000, i18n.t("validation.max", { max: 1000 })),
    location: z
      .object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().nullable().optional() })
      .nullable(),
    urgency: z.enum(["NOW", "TODAY", "WHENEVER"]),
    reward_type: z.enum(["NONE", "WILLING", "UNSURE"]),
    reward_amount: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{1,8}([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) >= 0), {
        message: i18n.t("validation.amount"),
      }),
    emergency_acknowledged: z.boolean(),
  })
  .refine((v) => v.location !== null, { path: ["location"], message: i18n.t("create.locationError") });

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
