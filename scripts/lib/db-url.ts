const PLACEHOLDER = "[YOUR-PASSWORD]";

/**
 * Supabase panelinden kopyalanan şifresiz adrese şifreyi güvenle yerleştirir.
 * Şifredeki `%`, `?`, `@` gibi işaretler adresi bozmasın diye kodlanır.
 * Adres zaten şifre içeriyorsa (yer tutucu yoksa) olduğu gibi döner.
 */
export function buildDbUrl(template: string, password: string | undefined): string {
  if (!template.includes(PLACEHOLDER)) return template;
  if (!password) {
    throw new Error("SUPABASE_DB_PASSWORD boş; veritabanı şifresini .env dosyasına yaz.");
  }
  return template.replace(PLACEHOLDER, encodeURIComponent(password));
}
