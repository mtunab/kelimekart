import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse } from "dotenv";

export const devUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasDevEnv = Boolean(devUrl && anonKey && serviceKey);

/** Prod adresine karşı test çalıştırmayı kesin olarak engeller. */
export function assertNotProd() {
  let prodUrl: string | undefined;
  try {
    prodUrl = parse(readFileSync(".env.prod.local"))["NEXT_PUBLIC_SUPABASE_URL"];
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

export type TestUser = {
  id: string;
  email: string;
  password: string;
  client: SupabaseClient;
};

/** Test e-postaları bu önekle başlar; temizlik yalnızca bunlara dokunur. */
export const TEST_EMAIL_PREFIX = "kk-test-";

export function testEmail(tag: string) {
  return `${TEST_EMAIL_PREFIX}${tag}-${crypto.randomUUID().slice(0, 8)}@example.com`;
}

function isTransient(value: unknown): boolean {
  const error = (value as { error?: { message?: string; status?: number } } | null)?.error;
  return (
    !!error && (error.status === 0 || /fetch failed|ECONNRESET|socket/i.test(error.message ?? ""))
  );
}

/**
 * Ağdaki geçici kopmalarda (fetch failed) isteği birkaç kez yeniden dener.
 * Supabase istemcisi bu hatayı fırlatmak yerine `{ error }` olarak döndürdüğü için ikisine de bakılır.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (!isTransient(result)) return result;
      last = result;
    } catch (error) {
      last = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
  }
  if (last instanceof Error) throw last;
  return last as T;
}

export type AuthUser = { id: string; email: string; password: string };

/** Dev'de şifresi bilinen, e-postası onaylı geçici kullanıcı oluşturur. */
export async function createAuthUser(tag: string, displayName = `Test ${tag}`): Promise<AuthUser> {
  const email = testEmail(tag);
  const password = `Kk-${crypto.randomUUID()}`;
  const { data, error } = await withRetry(() =>
    serviceClient().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  );
  if (error || !data.user) throw new Error(`Test kullanıcısı oluşturulamadı: ${error?.message}`);
  return { id: data.user.id, email, password };
}

/** Geçici kullanıcı oluşturur ve onun adına giriş yapmış bir istemci döndürür. */
export async function createTestUser(tag: string, displayName = `Test ${tag}`): Promise<TestUser> {
  const user = await createAuthUser(tag, displayName);
  const client = anonClient();
  const signIn = await withRetry(() =>
    client.auth.signInWithPassword({ email: user.email, password: user.password }),
  );
  if (signIn.error) throw new Error(`Test kullanıcısı giriş yapamadı: ${signIn.error.message}`);
  return { ...user, client };
}

export async function deleteTestUsers(users: Array<{ id: string } | undefined>) {
  const admin = serviceClient();
  for (const user of users) {
    if (user) await withRetry(() => admin.auth.admin.deleteUser(user.id));
  }
}

/** Önceki yarıda kalmış çalıştırmalardan kalan test kullanıcılarını siler. */
export async function deleteLeftoverTestUsers() {
  const admin = serviceClient();
  const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const user of data?.users ?? []) {
    if (user.email?.startsWith(TEST_EMAIL_PREFIX)) await admin.auth.admin.deleteUser(user.id);
  }
}
