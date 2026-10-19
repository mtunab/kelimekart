/**
 * Girişten sonra gidilecek adres. Sadece site içi yollara izin verilir;
 * "//kotu-site.com" gibi dış adreslere yönlendirme (open redirect) engellenir.
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
