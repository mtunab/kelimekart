import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";
import { THEMES } from "@/lib/theme";

export const profileSettingsSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, { error: "Display name can't be empty." })
    .max(40, { error: "Display name can be at most 40 characters." }),
  timezone: z.string().refine(isValidTimeZone, { error: "Invalid time zone." }),
  daily_new_limit: z.coerce
    .number({ error: "New cards per day must be a number." })
    .int({ error: "Use a whole number." })
    .min(0, { error: "Minimum is 0." })
    .max(200, { error: "Maximum is 200." }),
  daily_goal_reviews: z.coerce
    .number({ error: "Daily goal must be a number." })
    .int({ error: "Use a whole number." })
    .min(1, { error: "Minimum is 1." })
    .max(1000, { error: "Maximum is 1000." }),
});

export const themeSchema = z.enum(THEMES);
