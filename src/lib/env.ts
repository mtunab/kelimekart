import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/**
 * Tarayıcıya da gönderilebilen ortam değişkenleri.
 * Next.js `NEXT_PUBLIC_` değişkenlerini yalnızca açıkça yazıldığında pakete gömer,
 * bu yüzden her biri tek tek okunur.
 */
export function readPublicEnv(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
): PublicEnv {
  const parsed = publicEnvSchema.safeParse(source);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Supabase ortam değişkenleri eksik veya hatalı: ${missing}`);
  }
  return parsed.data;
}
