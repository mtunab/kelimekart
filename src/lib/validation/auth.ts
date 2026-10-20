import { z } from "zod";
import { loginIdentifierToEmail } from "@/lib/username";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, { error: "Enter your username." })
    .max(200)
    .transform((value, ctx) => {
      const email = loginIdentifierToEmail(value);
      if (!email) {
        ctx.addIssue({ code: "custom", message: "Wrong username or password." });
        return z.NEVER;
      }
      return email;
    }),
  password: z.string().min(1, { error: "Enter your password." }).max(200),
});

export const PASSWORD_MIN = 8;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, { error: `Password must be at least ${PASSWORD_MIN} characters.` })
      .max(72, { error: "Password can be at most 72 characters." }),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    error: "Passwords don't match.",
    path: ["confirm"],
  });

/** Formdan gelen ilk hata mesajını kullanıcıya gösterilecek tek cümleye çevirir. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check your input.";
}
