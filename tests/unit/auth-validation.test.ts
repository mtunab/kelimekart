import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/redirect";
import { emailSchema, loginSchema, newPasswordSchema } from "@/lib/validation/auth";
import { buildSetPasswordLink, parseInviteArgs } from "../../scripts/lib/invite";

describe("giriş doğrulaması", () => {
  it("e-postayı küçük harfe çevirir ve boşlukları kırpar", () => {
    expect(emailSchema.parse("  Ali@Ornek.COM ")).toBe("ali@ornek.com");
  });

  it("geçersiz e-postayı Türkçe mesajla reddeder", () => {
    const result = loginSchema.safeParse({ email: "ali", password: "x" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Geçerli bir e-posta adresi yaz.");
  });

  it("boş şifreyi reddeder", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("yeni şifre", () => {
  it("8 karakterden kısa şifreyi reddeder", () => {
    const result = newPasswordSchema.safeParse({ password: "kisa", confirm: "kisa" });
    expect(result.error?.issues[0]?.message).toMatch(/en az 8/);
  });

  it("tekrar alanı farklıysa reddeder", () => {
    const result = newPasswordSchema.safeParse({ password: "uzunsifre1", confirm: "uzunsifre2" });
    expect(result.error?.issues[0]?.message).toBe("Şifreler aynı değil.");
  });

  it("uygun şifreyi kabul eder", () => {
    expect(
      newPasswordSchema.safeParse({ password: "uzunsifre1", confirm: "uzunsifre1" }).success,
    ).toBe(true);
  });
});

describe("güvenli yönlendirme", () => {
  it.each([
    ["/desteler", "/desteler"],
    ["/calis?deste=1", "/calis?deste=1"],
    ["//kotu.com", "/"],
    ["/\\kotu.com", "/"],
    ["https://kotu.com", "/"],
    ["javascript:alert(1)", "/"],
    [undefined, "/"],
    [["/a", "/b"], "/"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("davet betiği", () => {
  it("yeni davet argümanlarını okur", () => {
    expect(parseInviteArgs(["Ali@Ornek.com", "Ali", "Veli"])).toEqual({
      mode: "invite",
      email: "ali@ornek.com",
      name: "Ali Veli",
      prod: false,
    });
  });

  it("--reset ve --prod bayraklarını okur", () => {
    expect(parseInviteArgs(["--reset", "ali@ornek.com", "--prod"])).toEqual({
      mode: "reset",
      email: "ali@ornek.com",
      prod: true,
    });
  });

  it("ad verilmeyen daveti reddeder", () => {
    expect(() => parseInviteArgs(["ali@ornek.com"])).toThrow();
  });

  it("şifre belirleme bağlantısını doğru kurar", () => {
    const link = new URL(buildSetPasswordLink("https://kk.example.com", "abc123"));
    expect(link.origin).toBe("https://kk.example.com");
    expect(link.pathname).toBe("/auth/confirm");
    expect(link.searchParams.get("token_hash")).toBe("abc123");
    expect(link.searchParams.get("type")).toBe("recovery");
    expect(link.searchParams.get("next")).toBe("/reset-password");
  });
});
