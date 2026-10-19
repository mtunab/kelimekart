import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";
import { THEMES } from "@/lib/theme";

export const profileSettingsSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, { error: "Görünen ad boş olamaz." })
    .max(40, { error: "Görünen ad en fazla 40 karakter." }),
  timezone: z.string().refine(isValidTimeZone, { error: "Geçersiz saat dilimi." }),
  daily_new_limit: z.coerce
    .number({ error: "Günlük yeni kart sayısı bir sayı olmalı." })
    .int({ error: "Tam sayı yaz." })
    .min(0, { error: "En az 0." })
    .max(200, { error: "En fazla 200." }),
  daily_goal_reviews: z.coerce
    .number({ error: "Günlük hedef bir sayı olmalı." })
    .int({ error: "Tam sayı yaz." })
    .min(1, { error: "En az 1." })
    .max(1000, { error: "En fazla 1000." }),
});

export const themeSchema = z.enum(THEMES);
