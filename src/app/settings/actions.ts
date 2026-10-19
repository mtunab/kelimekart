"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { field, type FormState } from "@/lib/form-state";
import { THEME_COOKIE } from "@/lib/theme";
import { firstError, newPasswordSchema } from "@/lib/validation/auth";
import { profileSettingsSchema, themeSchema } from "@/lib/validation/settings";

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    display_name: field(formData, "display_name"),
    timezone: field(formData, "timezone"),
    daily_new_limit: field(formData, "daily_new_limit"),
    daily_goal_reviews: field(formData, "daily_goal_reviews"),
  };
  const parsed = profileSettingsSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) return { error: "Kaydedilemedi. Biraz sonra tekrar dene.", values };

  revalidatePath("/", "layout");
  return { success: "Ayarlar kaydedildi." };
}

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({
    password: field(formData, "password"),
    confirm: field(formData, "confirm"),
  });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase } = await requireUser();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "same_password") return { error: "Yeni şifre eskisiyle aynı olamaz." };
    if (error.code === "weak_password") return { error: "Bu şifre çok zayıf." };
    return { error: "Şifre değiştirilemedi. Biraz sonra tekrar dene." };
  }
  return { success: "Şifren değişti." };
}

export async function setTheme(formData: FormData) {
  const theme = themeSchema.catch("system").parse(field(formData, "theme"));
  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/", "layout");
}
