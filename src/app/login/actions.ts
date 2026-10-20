"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { safeNextPath } from "@/lib/redirect";
import { firstError, loginSchema } from "@/lib/validation/auth";

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const username = field(formData, "username");
  const parsed = loginSchema.safeParse({
    identifier: username,
    password: field(formData, "password"),
  });
  if (!parsed.success) return { error: firstError(parsed.error), values: { username } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.identifier,
    password: parsed.data.password,
  });
  if (error) {
    console.error("Giriş başarısız:", error.code ?? "kod-yok", error.status ?? "-");
    if (error.status === 429) {
      return {
        error: "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.",
        values: { username },
      };
    }
    return { error: "Kullanıcı adı veya şifre hatalı.", values: { username } };
  }

  redirect(safeNextPath(field(formData, "next")));
}
