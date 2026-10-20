import { z } from "zod";
import { loginIdentifierToEmail } from "@/lib/username";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, { error: "Kullanıcı adını yaz." })
    .max(200)
    .transform((value, ctx) => {
      const email = loginIdentifierToEmail(value);
      if (!email) {
        ctx.addIssue({ code: "custom", message: "Kullanıcı adı veya şifre hatalı." });
        return z.NEVER;
      }
      return email;
    }),
  password: z.string().min(1, { error: "Şifreni yaz." }).max(200),
});

export const PASSWORD_MIN = 8;

export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, { error: `Şifre en az ${PASSWORD_MIN} karakter olmalı.` })
      .max(72, { error: "Şifre en fazla 72 karakter olabilir." }),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    error: "Şifreler aynı değil.",
    path: ["confirm"],
  });

/** Formdan gelen ilk hata mesajını kullanıcıya gösterilecek tek cümleye çevirir. */
export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Bilgileri kontrol et.";
}
