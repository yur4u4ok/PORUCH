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
    urgency: z.enum(["NOW", "TODAY", "WHENEVER", "SCHEDULED"]),
    /** "YYYY-MM-DDTHH:mm" in the user's local time (datetime-local input); for SCHEDULED only. */
    needed_at: z.string(),
    reward_type: z.enum(["NONE", "WILLING", "UNSURE"]),
    reward_amount: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d{1,8}([.,]\d{1,2})?$/.test(v) && Number(v.replace(",", ".")) >= 0), {
        message: "validation.amount",
      }),
    reward_options: z.array(z.enum(["PIZZA", "COFFEE", "RETURN_HELP", "GIVE_ITEM"])),
    emergency_acknowledged: z.boolean(),
  })
  .refine((v) => v.location !== null, { path: ["location"], message: "create.locationError" })
  .refine((v) => v.urgency !== "SCHEDULED" || v.needed_at !== "", {
    path: ["needed_at"],
    message: "create.neededAtRequired",
  })
  .refine(
    (v) =>
      v.urgency !== "SCHEDULED" || !v.needed_at || new Date(v.needed_at).getTime() > Date.now() + 14 * 60_000,
    {
      path: ["needed_at"],
      message: "create.neededAtTooSoon",
    },
  )
  .refine(
    (v) =>
      v.reward_type !== "WILLING" ||
      Number(v.reward_amount.replace(",", ".")) > 0 ||
      v.reward_options.length > 0,
    { path: ["reward_amount"], message: "reward.chooseAtLeastOne" },
  );

export type CreateHelpForm = z.infer<typeof createHelpSchema>;

export const STEP_FIELDS: (keyof CreateHelpForm)[][] = [
  ["category"],
  ["title", "description"],
  ["location"],
  ["urgency", "needed_at"],
  ["reward_type", "reward_amount", "reward_options"],
  [],
  [],
];
