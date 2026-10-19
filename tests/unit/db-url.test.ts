import { describe, expect, it } from "vitest";
import { buildDbUrl } from "../../scripts/lib/db-url";

const template = "postgresql://postgres.abc:[YOUR-PASSWORD]@host.example.com:5432/postgres";

describe("buildDbUrl", () => {
  it("özel işaretli şifreyi kodlayarak yerleştirir", () => {
    const url = buildDbUrl(template, "a%b?c!d,e@f/g");
    expect(url).toBe(
      "postgresql://postgres.abc:a%25b%3Fc!d%2Ce%40f%2Fg@host.example.com:5432/postgres",
    );
    expect(new URL(url).hostname).toBe("host.example.com");
    expect(decodeURIComponent(new URL(url).password)).toBe("a%b?c!d,e@f/g");
  });

  it("şifre yoksa anlaşılır hata verir", () => {
    expect(() => buildDbUrl(template, "")).toThrow(/SUPABASE_DB_PASSWORD/);
  });

  it("şifresi zaten içinde olan adresi değiştirmez", () => {
    const full = "postgresql://postgres.abc:sifre@host.example.com:5432/postgres";
    expect(buildDbUrl(full, undefined)).toBe(full);
  });
});
