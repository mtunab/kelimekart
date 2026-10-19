import { describe, expect, it } from "vitest";
import { readPublicEnv } from "@/lib/env";

describe("readPublicEnv", () => {
  it("geçerli değerleri kabul eder", () => {
    const env = readPublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_0123456789abcdef",
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://abcdefghijklmnop.supabase.co");
  });

  it("eksik değerde hangi alanın eksik olduğunu söyler", () => {
    expect(() =>
      readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnop.supabase.co" }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });

  it("adres olmayan URL'yi reddeder", () => {
    expect(() =>
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "bir-adres-degil",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_0123456789abcdef",
      }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
