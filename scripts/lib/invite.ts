import { z } from "zod";

export const inviteArgsSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("invite"),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    name: z.string().trim().min(1).max(40),
    prod: z.boolean(),
  }),
  z.object({
    mode: z.literal("reset"),
    email: z.string().trim().toLowerCase().pipe(z.email()),
    prod: z.boolean(),
  }),
]);

export type InviteArgs = z.infer<typeof inviteArgsSchema>;

/**
 * Komut satırı:
 *   <e-posta> <görünen ad> [--prod]      → yeni kullanıcı + davet bağlantısı
 *   --reset <e-posta> [--prod]            → mevcut kullanıcıya yeni şifre bağlantısı
 */
export function parseInviteArgs(argv: string[]): InviteArgs {
  const prod = argv.includes("--prod");
  const reset = argv.includes("--reset");
  const rest = argv.filter((arg) => arg !== "--prod" && arg !== "--reset" && arg !== "--");
  if (reset) return inviteArgsSchema.parse({ mode: "reset", email: rest[0] ?? "", prod });
  return inviteArgsSchema.parse({
    mode: "invite",
    email: rest[0] ?? "",
    name: rest.slice(1).join(" "),
    prod,
  });
}

/** Kullanıcının tıklayacağı bağlantı: kodu doğrular ve şifre belirleme sayfasına götürür. */
export function buildSetPasswordLink(siteUrl: string, hashedToken: string): string {
  const url = new URL("/auth/confirm", siteUrl);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "recovery");
  url.searchParams.set("next", "/reset-password");
  return url.toString();
}
