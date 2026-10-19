"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { safeNextPath } from "@/lib/redirect";
import { firstError, loginSchema } from "@/lib/validation/auth";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  const parsed = loginSchema.safeParse({ email, password: field(formData, "password") });
  if (!parsed.success) return { error: firstError(parsed.error), values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    console.error("Giriş başarısız:", error.code ?? "kod-yok", error.status ?? "-");
    if (error.status === 429) {
      return {
        error: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.",
        values: { email },
      };
    }
    return { error: "E-posta veya şifre hatalı.", values: { email } };
  }

  redirect(safeNextPath(field(formData, "next")));
}
