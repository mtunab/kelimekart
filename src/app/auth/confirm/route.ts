import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";

const ALLOWED_TYPES: EmailOtpType[] = ["recovery", "invite", "email", "magiclink"];

/**
 * Davet ve şifre sıfırlama bağlantıları buraya gelir. İki biçim desteklenir:
 * - `token_hash` + `type`: davet betiğinin ürettiği bağlantı (her tarayıcıda çalışır)
 * - `code`: Supabase'in varsayılan e-posta şablonundan gelen bağlantı (isteğin yapıldığı tarayıcıda)
 * Doğrulama başarılıysa oturum açılır ve kullanıcı `next` sayfasına gider.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const next = safeNextPath(params.get("next"));
  const supabase = await createClient();

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }

  redirect("/login?error=link");
}
