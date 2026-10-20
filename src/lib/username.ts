import { z } from "zod";

/**
 * Kullanıcı adıyla giriş. Supabase Auth e-posta istediği için her kullanıcı adı bu iç adrese eşlenir.
 * ".invalid" gerçek bir alan adı olamaz (RFC 2606): bu adreslere asla e-posta gitmez.
 * Veritabanındaki `profiles_username_format` kısıtıyla aynı kural.
 */
export const INTERNAL_EMAIL_DOMAIN = "users.kelimekart.invalid";
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,20}$/;

export const usernameSchema = z.string().trim().toLowerCase().regex(USERNAME_PATTERN, {
  error: "Username must be 3-20 characters: lowercase letters, digits, dot, underscore or dash.",
});

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${INTERNAL_EMAIL_DOMAIN}`;
}

/**
 * Giriş kutusuna yazılanı Supabase'in beklediği e-postaya çevirir.
 * "@" içeriyorsa e-posta kabul edilir (eski hesaplar), değilse kullanıcı adıdır.
 * Geçersizse null.
 */
export function loginIdentifierToEmail(input: string): string | null {
  const value = input.trim().toLowerCase();
  if (value.includes("@")) {
    return z.email().safeParse(value).success ? value : null;
  }
  const parsed = usernameSchema.safeParse(value);
  return parsed.success ? usernameToEmail(parsed.data) : null;
}
