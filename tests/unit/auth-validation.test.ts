import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/redirect";
import {
  INTERNAL_EMAIL_DOMAIN,
  loginIdentifierToEmail,
  usernameSchema,
  usernameToEmail,
} from "@/lib/username";
import { loginSchema, newPasswordSchema } from "@/lib/validation/auth";
import { parseUserArgs } from "../../scripts/lib/user-args";

describe("kullanıcı adı", () => {
  it.each(["tuna", "ali.veli", "ayse_k", "can-2", "abc", "a".repeat(20)])("%s geçerli", (name) => {
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it.each(["ab", "a".repeat(21), "ali veli", "şule", "tuna!", "", "ali@x"])(
    "%j geçersiz",
    (name) => {
      expect(usernameSchema.safeParse(name).success).toBe(false);
    },
  );

  it("büyük harfi ve boşlukları düzeltir", () => {
    expect(usernameSchema.parse("  Tuna ")).toBe("tuna");
  });

  it("iç e-postaya çevrilir; .invalid alan adı gerçek olamaz", () => {
    expect(usernameToEmail("Tuna")).toBe("tuna@users.kelimekart.invalid");
    expect(INTERNAL_EMAIL_DOMAIN.endsWith(".invalid")).toBe(true);
  });
});

describe("giriş kutusu", () => {
  it("kullanıcı adını iç e-postaya çevirir", () => {
    expect(loginIdentifierToEmail(" TUNA ")).toBe("tuna@users.kelimekart.invalid");
  });

  it("@ içeriyorsa e-posta olarak kabul eder (eski hesaplar)", () => {
    expect(loginIdentifierToEmail("Ali@Ornek.com")).toBe("ali@ornek.com");
  });

  it("geçersiz girişte null döner", () => {
    expect(loginIdentifierToEmail("a b")).toBeNull();
    expect(loginIdentifierToEmail("x@y")).toBeNull();
  });

  it("giriş doğrulaması e-postayı üretir, Türkçe hata verir", () => {
    expect(loginSchema.parse({ identifier: "tuna", password: "x" }).identifier).toBe(
      "tuna@users.kelimekart.invalid",
    );
    expect(loginSchema.safeParse({ identifier: "", password: "x" }).error?.issues[0]?.message).toBe(
      "Kullanıcı adını yaz.",
    );
    expect(loginSchema.safeParse({ identifier: "tuna", password: "" }).success).toBe(false);
  });
});

describe("yeni şifre", () => {
  it("8 karakterden kısa şifreyi reddeder", () => {
    const result = newPasswordSchema.safeParse({ password: "anut", confirm: "anut" });
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

describe("kullanıcı yönetim komutu", () => {
  it("hesap açma argümanlarını okur", () => {
    expect(parseUserArgs(["add", "Tuna", "Tuna", "B.", "--prod"])).toEqual({
      action: "add",
      username: "tuna",
      displayName: "Tuna B.",
      prod: true,
    });
  });

  it("görünen ad verilmezse kullanıcı adını kullanır", () => {
    expect(parseUserArgs(["add", "ali"])).toMatchObject({ displayName: "ali", prod: false });
  });

  it("şifre, silme ve liste komutları", () => {
    expect(parseUserArgs(["password", "ali"])).toEqual({
      action: "password",
      username: "ali",
      prod: false,
    });
    expect(parseUserArgs(["remove", "ali", "--prod"])).toEqual({
      action: "remove",
      username: "ali",
      prod: true,
    });
    expect(parseUserArgs(["list"])).toEqual({ action: "list", prod: false });
  });

  it("geçersiz kullanıcı adını ve bilinmeyen komutu reddeder", () => {
    expect(() => parseUserArgs(["add", "a b"])).toThrow(/3-20 karakter/);
    expect(() => parseUserArgs(["sil", "ali"])).toThrow(/Kullanım/);
  });
});
