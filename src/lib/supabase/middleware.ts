import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readPublicEnv } from "@/lib/env";

/**
 * Her istekte Supabase oturum çerezini tazeler ve kullanıcıyı döndürür.
 * Next.js 16'da "middleware" dosyasının adı "proxy" oldu; bu yardımcı `src/proxy.ts` içinden çağrılır.
 */
export async function updateSession(request: NextRequest) {
  const env = readPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getUser() sunucuya sorarak doğrular; çerezdeki bilgiye körü körüne güvenmez.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
