import { describe, expect, it } from "vitest";
import {
  cardInputSchema,
  cardListParamsSchema,
  deckInputSchema,
  importRowsSchema,
  splitTags,
} from "@/lib/validation/cards";

describe("kart doğrulama", () => {
  it("alanları kırpar, boş isteğe bağlı alanları null yapar", () => {
    expect(
      cardInputSchema.parse({
        front: " apple ",
        back: " elma ",
        example: "  ",
        note: "",
        tags: "",
      }),
    ).toEqual({ front: "apple", back: "elma", example: null, note: null, tags: [] });
  });

  it("boş ön/arka yüzü Türkçe mesajla reddeder", () => {
    const front = cardInputSchema.safeParse({ front: "  ", back: "x" });
    expect(front.error?.issues[0]?.message).toBe("Ön yüz boş olamaz.");
    const back = cardInputSchema.safeParse({ front: "x", back: "" });
    expect(back.error?.issues[0]?.message).toBe("Arka yüz boş olamaz.");
  });

  it("çok uzun alanları reddeder", () => {
    expect(cardInputSchema.safeParse({ front: "x".repeat(201), back: "y" }).success).toBe(false);
    expect(cardInputSchema.safeParse({ front: "x", back: "y".repeat(501) }).success).toBe(false);
  });

  it("etiketleri virgül veya | ile ayırır, tekrarları atar", () => {
    expect(splitTags("A1, fiil | A1 ,  günlük  hayat ,,")).toEqual(["A1", "fiil", "günlük hayat"]);
    expect(cardInputSchema.parse({ front: "a", back: "b", tags: "x, y" }).tags).toEqual(["x", "y"]);
  });

  it("10'dan fazla etiketi reddeder", () => {
    const tags = Array.from({ length: 11 }, (_, i) => `t${i}`).join(",");
    expect(cardInputSchema.safeParse({ front: "a", back: "b", tags }).success).toBe(false);
  });
});

describe("deste doğrulama", () => {
  it("geçerli desteyi kabul eder", () => {
    expect(
      deckInputSchema.parse({ name: " Fiiller ", source_lang: "en", target_lang: "tr" }),
    ).toEqual({ name: "Fiiller", source_lang: "en", target_lang: "tr" });
  });

  it("aynı dil çiftini ve bilinmeyen dili reddeder", () => {
    expect(
      deckInputSchema.safeParse({ name: "x", source_lang: "en", target_lang: "en" }).success,
    ).toBe(false);
    expect(
      deckInputSchema.safeParse({ name: "x", source_lang: "xx", target_lang: "tr" }).success,
    ).toBe(false);
  });
});

describe("liste parametreleri", () => {
  it("bozuk parametreleri güvenli varsayılana çevirir", () => {
    expect(cardListParamsSchema.parse({ sayfa: "abc", q: "x".repeat(500), arsiv: "evet" })).toEqual(
      {
        q: "",
        etiket: "",
        sayfa: 1,
        arsiv: false,
      },
    );
    expect(cardListParamsSchema.parse({ sayfa: "3", q: " elma ", arsiv: "1" })).toMatchObject({
      sayfa: 3,
      q: "elma",
      arsiv: true,
    });
  });
});

describe("içe aktarma onayı", () => {
  it("boş listeyi ve 2000'den fazlasını reddeder", () => {
    expect(importRowsSchema.safeParse([]).success).toBe(false);
    const many = Array.from({ length: 2001 }, (_, i) => ({
      front: `w${i}`,
      back: "x",
      example: null,
      note: null,
      tags: [],
    }));
    expect(importRowsSchema.safeParse(many).success).toBe(false);
  });
});
