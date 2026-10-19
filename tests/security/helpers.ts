import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { parse } from "dotenv";

export const devUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasDevEnv = Boolean(devUrl && anonKey && serviceKey);

/** Prod adresine karşı test çalıştırmayı kesin olarak engeller. */
export function assertNotProd() {
  let prodUrl: string | undefined;
  try {
    prodUrl = parse(readFileSync(".env.production.local"))["NEXT_PUBLIC_SUPABASE_URL"];
  } catch {
    prodUrl = undefined;
  }
  if (prodUrl && prodUrl === devUrl) {
    throw new Error("Testler prod veritabanına karşı çalıştırılamaz.");
  }
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

export function anonClient() {
  return createClient(devUrl, anonKey, noSession);
}

export function serviceClient() {
  return createClient(devUrl, serviceKey, noSession);
}

export { anonKey };
