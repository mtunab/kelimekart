import { describe, expect, it } from "vitest";
import {
  formatInterval,
  fromFsrsCard,
  GRADES,
  isGrade,
  previewDueDates,
  Rating,
  review,
  State,
  toFsrsCard,
  type Card,
} from "@/lib/srs";

const T0 = new Date("2026-03-01T09:00:00.000Z");
const minutes = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;
const days = (a: Date, b: Date) => minutes(a, b) / 1440;

function newCard() {
  return toFsrsCard(null, T0);
}

/** Kartı "İyi" ile tekrar durumuna getirir (öğrenme adımlarını geçerek). */
function graduate(): { card: Card; at: Date } {
  let card = newCard();
  let at = T0;
  for (let i = 0; i < 5 && card.state !== State.Review; i++) {
    card = review(card, Rating.Good, at);
    at = card.due;
  }
  return { card, at };
}

describe("SRS: yeni kart", () => {
  it("satır yoksa boş, yeni bir kart üretir", () => {
    const card = newCard();
    expect(card.state).toBe(State.New);
    expect(card.reps).toBe(0);
    expect(card.due.getTime()).toBe(T0.getTime());
  });

  it.each(GRADES)("puan %i sonrası reps 1 olur, vade ileri gider", (grade) => {
    const next = review(newCard(), grade, T0);
    expect(next.reps).toBe(1);
    expect(next.last_review?.getTime()).toBe(T0.getTime());
    expect(next.due.getTime()).toBeGreaterThan(T0.getTime());
  });

  it("Tekrar < Zor < İyi < Kolay sırasıyla daha uzak vade verir", () => {
    const dues = GRADES.map((grade) => review(newCard(), grade, T0).due.getTime());
    expect(dues[0]!).toBeLessThan(dues[1]!);
    expect(dues[1]!).toBeLessThan(dues[2]!);
    expect(dues[2]!).toBeLessThan(dues[3]!);
  });

  it("Tekrar ve İyi öğrenme durumuna, Kolay doğrudan tekrar durumuna geçer", () => {
    expect(review(newCard(), Rating.Again, T0).state).toBe(State.Learning);
    expect(review(newCard(), Rating.Good, T0).state).toBe(State.Learning);
    expect(review(newCard(), Rating.Easy, T0).state).toBe(State.Review);
  });

  it("Tekrar dakikalar içinde geri gelir", () => {
    const next = review(newCard(), Rating.Again, T0);
    expect(minutes(T0, next.due)).toBeLessThanOrEqual(10);
  });
});

describe("SRS: öğrenme ve tekrar", () => {
  it("İyi ile birkaç adımda tekrar durumuna geçer ve günlerce sonraya planlanır", () => {
    const { card } = graduate();
    expect(card.state).toBe(State.Review);
    expect(days(card.last_review!, card.due)).toBeGreaterThanOrEqual(1);
  });

  it("tekrar durumundaki kartta İyi aralığı büyütür", () => {
    const { card } = graduate();
    const firstInterval = days(card.last_review!, card.due);
    const next = review(card, Rating.Good, card.due);
    expect(days(card.due, next.due)).toBeGreaterThan(firstInterval);
  });

  it("tekrar durumundaki kartta Tekrar unutma sayar ve yeniden öğrenmeye alır", () => {
    const { card } = graduate();
    const next = review(card, Rating.Again, card.due);
    expect(next.lapses).toBe(card.lapses + 1);
    expect(next.state).toBe(State.Relearning);
    expect(minutes(card.due, next.due)).toBeLessThan(60);
  });

  it("geç kalınan tekrar da işlenir (vadeden 10 gün sonra)", () => {
    const { card } = graduate();
    const late = new Date(card.due.getTime() + 10 * 86_400_000);
    const next = review(card, Rating.Good, late);
    expect(next.due.getTime()).toBeGreaterThan(late.getTime());
  });

  it("aynı girdiyle aynı sonucu verir (saf fonksiyon)", () => {
    const { card } = graduate();
    const a = review(card, Rating.Good, card.due);
    const b = review(card, Rating.Good, card.due);
    expect(fromFsrsCard(a)).toEqual(fromFsrsCard(b));
  });
});

describe("SRS: önizleme", () => {
  it("dört buton için vadeler artan sırada", () => {
    const preview = previewDueDates(newCard(), T0);
    expect(preview[Rating.Again].getTime()).toBeLessThan(preview[Rating.Hard].getTime());
    expect(preview[Rating.Good].getTime()).toBeLessThan(preview[Rating.Easy].getTime());
  });

  it("önizleme ile gerçek cevap aynı vadeyi verir", () => {
    const { card } = graduate();
    const preview = previewDueDates(card, card.due);
    expect(review(card, Rating.Good, card.due).due.getTime()).toBe(preview[Rating.Good].getTime());
  });
});

describe("SRS: veritabanı dönüşümü", () => {
  it("satır → kart → satır kayıpsız", () => {
    const { card } = graduate();
    const row = fromFsrsCard(card);
    expect(fromFsrsCard(toFsrsCard(row, T0))).toEqual(row);
  });

  it("tarihler UTC ISO metni olarak saklanır", () => {
    const row = fromFsrsCard(review(newCard(), Rating.Good, T0));
    expect(row.due).toMatch(/Z$/);
    expect(row.last_review).toBe(T0.toISOString());
  });

  it("yeni kartta last_review null", () => {
    expect(fromFsrsCard(newCard()).last_review).toBeNull();
  });
});

describe("yardımcılar", () => {
  it.each([
    [0, "1m"],
    [10, "10m"],
    [90, "2h"],
    [60 * 24 * 3, "3d"],
    [60 * 24 * 65, "2mo"],
    [60 * 24 * 365 * 1.5, "1.5y"],
  ])("%i dakika → %s", (mins, text) => {
    expect(formatInterval(T0, new Date(T0.getTime() + mins * 60_000))).toBe(text);
  });

  it("geçerli puanları tanır", () => {
    expect([0, 1, 2, 3, 4, 5, "3"].map(isGrade)).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});
