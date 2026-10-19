import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readPublicEnv } from "@/lib/env";

/**
 * Sunucu bileşenleri, server action'lar ve route handler'lar için Supabase istemcisi.
 * Her istekte yeniden oluşturulmalı; istekler arasında paylaşılmaz.
 */
export async function createClient() {
  const env = readPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Sunucu bileşeninden çağrıldığında çerez yazılamaz; oturum yenileme proxy'de yapılır.
        }
      },
    },
  });
}
