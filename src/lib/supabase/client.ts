import { createBrowserClient } from "@supabase/ssr";
import { readPublicEnv } from "@/lib/env";

/** Tarayıcı tarafı ("use client" bileşenleri) için Supabase istemcisi. */
export function createClient() {
  const env = readPublicEnv();
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
