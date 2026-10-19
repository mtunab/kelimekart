"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { emailSchema } from "@/lib/validation/auth";

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = field(formData, "email");
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { error: "Geçerli bir e-posta adresi yaz.", values: { email } };

  const supabase = await createClient();
  const siteUrl = process.env.SITE_URL ?? (await headers()).get("origin") ?? "";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error?.status === 429) {
    return { error: "Çok fazla istek yapıldı. Biraz bekleyip tekrar dene.", values: { email } };
  }

  // Adresin kayıtlı olup olmadığını belli etmemek için her durumda aynı mesaj.
  return {
    success:
      "Bu adres kayıtlıysa birkaç dakika içinde şifre sıfırlama bağlantısı gelecek. Gelmezse grup yöneticisinden yeni bağlantı iste.",
  };
}
