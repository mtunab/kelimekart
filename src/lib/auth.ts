import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  timezone: string;
  daily_new_limit: number;
  daily_goal_reviews: number;
  streak_count: number;
  streak_last_day: string | null;
};

/**
 * Giriş yapmış kullanıcıyı ve profilini döndürür; yoksa giriş sayfasına yollar.
 * Aynı istek içinde birden çok çağrıda veritabanına tek kez gider.
 */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  // Oturumu yerelde doğrula (imza + süre); Supabase'e ek istek yok.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const user = { id: userId };

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, timezone, daily_new_limit, daily_goal_reviews, streak_count, streak_last_day",
    )
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/login?error=profile");

  return { supabase, user, profile };
});
