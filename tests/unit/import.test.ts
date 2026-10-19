import { describe, expect, it } from "vitest";
import { cardsToCsv, csvFileName } from "@/lib/import/csv";
import { detectDelimiter, parseImport, splitRows } from "@/lib/import/parse";

describe("ayırıcı tespiti", () => {
  it.each([
    ["apple ; elma\npear ; armut", ";"],
    ["apple\telma\npear\tarmut", "\t"],
    ["apple,elma\npear,armut", ","],
    ['"apple, red",elma', ","],
    ["sadece kelime", ";"],
  ])("%j → %j", (text, expected) => {
    expect(detectDelimiter(text)).toBe(expected);
  });

  it("noktalı virgül varken anlamdaki virgül ayırıcı sanılmaz", () => {
    const result = parseImport("run ; koşmak, çalışmak\nset ; ayarlamak, koymak");
    expect(result.delimiter).toBe(";");
    expect(result.cards.map((c) => c.back)).toEqual(["koşmak, çalışmak", "ayarlamak, koymak"]);
  });
});

describe("noktalı virgüllü satırlar", () => {
  it("kelime ; anlam satırlarını okur, boşlukları kırpar", () => {
    const { cards, errors } = parseImport("  apple ;  elma \n\npear;armut\r\n");
    expect(errors).toEqual([]);
    expect(cards.map(({ front, back }) => ({ front, back }))).toEqual([
      { front: "apple", back: "elma" },
      { front: "pear", back: "armut" },
    ]);
  });

  it("örnek, not ve etiket sütunlarını okur", () => {
    const { cards } = parseImport("apple;elma;I ate an apple.;meyve adı;meyve|A1");
    expect(cards[0]).toMatchObject({
      example: "I ate an apple.",
      note: "meyve adı",
      tags: ["meyve", "A1"],
    });
  });

  it("satır numaralarını doğru verir", () => {
    const { cards } = parseImport("a;1\n\nb;2");
    expect(cards.map((c) => c.line)).toEqual([1, 3]);
  });
});

describe("bozuk satırlar", () => {
  it("anlamı olmayan satırı hata olarak bildirir, diğerlerini okur", () => {
    const { cards, errors } = parseImport("apple;elma\nyalnız\n;sadece anlam\npear;armut");
    expect(cards.map((c) => c.front)).toEqual(["apple", "pear"]);
    expect(errors).toEqual([
      { line: 2, message: '"yalnız" için anlam yok.' },
      { line: 3, message: "Ön yüz boş." },
    ]);
  });

  it("çok uzun ön yüzü reddeder", () => {
    const { errors } = parseImport(`${"x".repeat(201)};uzun`);
    expect(errors[0]?.message).toBe("Ön yüz çok uzun.");
  });

  it("boş girişte hiçbir şey döndürmez", () => {
    expect(parseImport("   \n\n")).toMatchObject({ cards: [], errors: [] });
  });
});

describe("tırnaklı CSV", () => {
  it("virgül içeren tırnaklı alanı tek hücre okur", () => {
    const { cards } = parseImport('"to run, to jog",koşmak\n"set",ayarlamak');
    expect(cards.map((c) => c.front)).toEqual(["to run, to jog", "set"]);
  });

  it('kaçışlı tırnağı ("") çözer', () => {
    const { cards } = parseImport('"say ""hi""","""merhaba"" de"');
    expect(cards[0]).toMatchObject({ front: 'say "hi"', back: '"merhaba" de' });
  });

  it("tırnak içindeki satır sonunu korur ve sonraki satır numarasını doğru sayar", () => {
    const { cards } = parseImport('apple,"elma\n(meyve)"\npear,armut');
    expect(cards[0]?.back).toBe("elma\n(meyve)");
    expect(cards[1]?.line).toBe(3);
  });

  it("başlık satırını atlar", () => {
    const { cards } = parseImport("front,back,example\napple,elma,An apple.");
    expect(cards).toHaveLength(1);
    expect(cards[0]?.front).toBe("apple");
  });

  it("Türkçe başlığı da tanır", () => {
    expect(parseImport("Kelime;Anlam\nkedi;cat").cards.map((c) => c.front)).toEqual(["kedi"]);
  });

  it("Excel'in eklediği BOM'u yok sayar", () => {
    expect(parseImport("﻿apple;elma").cards[0]?.front).toBe("apple");
  });

  it("sekmeyle ayrılmış yapıştırmayı okur", () => {
    expect(splitRows("a\tb\tc\nd\te", "\t").map((r) => r.cells)).toEqual([
      ["a", "b", "c"],
      ["d", "e"],
    ]);
  });
});

describe("çift kelime", () => {
  it("aynı girişte tekrar eden kelimeyi işaretler (büyük/küçük harf duyarsız)", () => {
    const { cards } = parseImport("apple;elma\nApple ;elma 2\npear;armut");
    expect(cards.map((c) => c.duplicateInInput)).toEqual([false, true, false]);
  });

  it("Türkçe büyük/küçük harfi doğru eşler (İ/i aynı, ı/i farklı)", () => {
    const { cards } = parseImport("İyi;good\niyi;fine\nılık;lukewarm\nilik;marrow");
    expect(cards.map((c) => c.duplicateInInput)).toEqual([false, true, false, false]);
  });
});

describe("CSV dışa aktarma", () => {
  const sample = [
    {
      front: "apple",
      back: "elma",
      example: "An apple, please.",
      note: null,
      tags: ["meyve", "A1"],
    },
    { front: 'say "hi"', back: "selam\nver", example: null, note: "not", tags: [] },
    { front: "çğıöşü", back: "ÇĞİÖŞÜ", example: null, note: null, tags: [] },
  ];

  it("başlık ve BOM ekler", () => {
    const csv = cardsToCsv([]);
    expect(csv.startsWith("﻿front,back,example,note,tags")).toBe(true);
  });

  it("dışa aktar → içe aktar kayıpsız (gidiş-dönüş)", () => {
    const { cards, errors } = parseImport(cardsToCsv(sample));
    expect(errors).toEqual([]);
    expect(
      cards.map(({ front, back, example, note, tags }) => ({ front, back, example, note, tags })),
    ).toEqual(sample);
  });

  it("formül gibi başlayan hücreleri etkisizleştirir", () => {
    const csv = cardsToCsv([{ front: "=1+1", back: "@x", example: null, note: null, tags: [] }]);
    expect(csv).toContain("'=1+1,'@x");
  });

  it("dosya adını Türkçe karakterlerden arındırır", () => {
    expect(csvFileName("Günlük İngilizce: Şehir")).toBe("kelimekart-gunluk-ingilizce-sehir.csv");
    expect(csvFileName("???")).toBe("kelimekart-deste.csv");
  });
});
