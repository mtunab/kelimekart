"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { field, type FormState } from "@/lib/form-state";
import { firstError, newPasswordSchema } from "@/lib/validation/auth";

export async function setNewPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({
    password: field(formData, "password"),
    confirm: field(formData, "confirm"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=link");

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Yeni şifre eskisiyle aynı olamaz." };
    if (error.code === "weak_password") {
      return { error: "Bu şifre çok zayıf, daha güçlü bir şifre seç." };
    }
    return { error: "Şifre kaydedilemedi. Biraz sonra tekrar dene." };
  }

  redirect("/?durum=sifre");
}
