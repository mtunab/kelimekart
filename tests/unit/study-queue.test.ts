import { describe, expect, it } from "vitest";
import { countGap, MIN_GAP, pickNext, type QueueSlot } from "@/lib/study-queue";

const slot = (cardId: string, availableAt = 0, gapLeft = 0): QueueSlot => ({
  cardId,
  availableAt,
  gapLeft,
});

describe("sıradaki kartı seçme", () => {
  it("boş listede bitti der", () => {
    expect(pickNext([], 1000, null)).toEqual({ kind: "empty" });
  });

  it("hazır ve aralığı dolmuş ilk kartı seçer", () => {
    const q = [slot("a", 0, 2), slot("b"), slot("c")];
    expect(pickNext(q, 1000, null)).toEqual({ kind: "card", index: 1 });
  });

  it("dönüş zamanı gelmemiş kartı göstermez, en erken zamana kadar bekletir", () => {
    const q = [slot("a", 5000), slot("b", 3000)];
    expect(pickNext(q, 1000, null)).toEqual({ kind: "wait", until: 3000 });
  });

  it("tek kart kaldıysa zamanı gelince (aralık dolmasa da) gösterir", () => {
    expect(pickNext([slot("a", 1000, MIN_GAP)], 1000, "a")).toEqual({ kind: "card", index: 0 });
  });

  it("aralığı dolmamış kartlar arasında az önce gösterileni seçmez", () => {
    const q = [slot("a", 0, 3), slot("b", 0, 2)];
    expect(pickNext(q, 1000, "b")).toEqual({ kind: "card", index: 0 });
  });

  it("cevaplanan kart dışındaki kartların aralık sayacı bir azalır, sıfırın altına inmez", () => {
    const q = [slot("a", 0, 2), slot("b", 0, 0), slot("c", 0, 3)];
    expect(countGap(q, "c").map((s) => s.gapLeft)).toEqual([1, 0, 3]);
  });
});

/** Oturumu taklit eder: her cevapta kart 1 dk sonraya "Again" ile ya da tamamen çıkar. */
function simulate(cards: string[], again: Set<string>, steps: number) {
  let queue = cards.map((id) => slot(id));
  let now = 0;
  let last: string | null = null;
  const shown: string[] = [];
  const times: number[] = [];
  for (let i = 0; i < steps; i++) {
    const pick = pickNext(queue, now, last);
    if (pick.kind === "empty") break;
    if (pick.kind === "wait") {
      now = pick.until;
      continue;
    }
    const card = queue[pick.index]!;
    shown.push(card.cardId);
    times.push(now);
    const rest = countGap(
      queue.filter((s) => s.cardId !== card.cardId),
      card.cardId,
    );
    queue = again.has(card.cardId) ? [...rest, slot(card.cardId, now + 60_000, MIN_GAP)] : rest;
    last = card.cardId;
    now += 5_000; // her kart ~5 sn
  }
  return { shown, times };
}

describe("oturum taklidi (videodaki durum)", () => {
  it("iki zor kart kalınca aynı kart arka arkaya gelmez ve beklemeden tekrar çıkmaz", () => {
    const { shown, times } = simulate(["refrain", "exploit"], new Set(["refrain", "exploit"]), 20);
    expect(shown.length).toBeGreaterThan(4);
    for (let i = 1; i < shown.length; i++) expect(shown[i]).not.toBe(shown[i - 1]);
    // Aynı kartın iki görünüşü arasında en az 1 dakika geçer (eskiden ~5 saniyede geri geliyordu).
    const lastSeen = new Map<string, number>();
    shown.forEach((id, i) => {
      const before = lastSeen.get(id);
      if (before !== undefined) expect(times[i]! - before).toBeGreaterThanOrEqual(60_000);
      lastSeen.set(id, times[i]!);
    });
  });

  it("çok kart varken yanlış bilinen kart araya en az 3 kart girmeden dönmez", () => {
    const { shown } = simulate(["a", "b", "c", "d", "e", "f"], new Set(["a"]), 20);
    const first = shown.indexOf("a");
    const second = shown.indexOf("a", first + 1);
    expect(second - first - 1).toBeGreaterThanOrEqual(MIN_GAP);
  });
});
