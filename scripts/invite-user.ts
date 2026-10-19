/**
 * Gruba yeni kişi ekler (davet) veya şifresini unutan kişiye yeni bağlantı üretir.
 *
 *   pnpm invite ali@ornek.com "Ali"            → dev'de kullanıcı oluşturur, bağlantı yazar
 *   pnpm invite ali@ornek.com "Ali" --prod     → canlı sitede
 *   pnpm invite --reset ali@ornek.com [--prod] → şifre yenileme bağlantısı
 *
 * Bağlantıyı kişiye WhatsApp vb. ile gönder. Bağlantı tek kullanımlıktır ve
 * Supabase'in "Email OTP Expiration" süresi kadar (varsayılan 1 saat) geçerlidir.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { ZodError } from "zod";
import { buildSetPasswordLink, parseInviteArgs } from "./lib/invite";

async function main() {
  let args;
  try {
    args = parseInviteArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof ZodError) {
      console.error(
        'Kullanım:\n  pnpm invite <e-posta> "<görünen ad>" [--prod]\n  pnpm invite --reset <e-posta> [--prod]',
      );
      process.exit(1);
    }
    throw error;
  }

  config({ path: args.prod ? ".env.prod.local" : ".env.local", quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const siteUrl = process.env.SITE_URL;
  if (!url || !serviceKey || !siteUrl) {
    console.error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ve SITE_URL gerekli.");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (args.mode === "invite") {
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    const { data: limit } = await admin.rpc("max_profiles");
    if (typeof count === "number" && typeof limit === "number" && count >= limit) {
      console.error(`Grup dolu: en fazla ${limit} kişi olabilir (şu an ${count}).`);
      process.exit(1);
    }

    const { error } = await admin.auth.admin.createUser({
      email: args.email,
      email_confirm: true,
      user_metadata: { display_name: args.name },
    });
    if (error) {
      const exists = error.code === "email_exists" || /already/i.test(error.message);
      console.error(
        exists
          ? "Bu e-posta zaten kayıtlı. Şifre bağlantısı için --reset kullan."
          : `Kullanıcı oluşturulamadı: ${error.message}`,
      );
      process.exit(1);
    }
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: args.email,
  });
  if (error || !data.properties) {
    console.error(`Bağlantı üretilemedi: ${error?.message ?? "bilinmeyen hata"}`);
    process.exit(1);
  }

  const link = buildSetPasswordLink(siteUrl, data.properties.hashed_token);
  console.log(
    args.mode === "invite"
      ? `✓ ${args.email} eklendi (${args.prod ? "CANLI" : "dev"}). Bu bağlantıyı kişiye gönder:`
      : `✓ ${args.email} için şifre yenileme bağlantısı (${args.prod ? "CANLI" : "dev"}):`,
  );
  console.log(`\n${link}\n`);
  console.log("Bağlantı tek kullanımlık ve yaklaşık 1 saat geçerli.");
}

void main();
