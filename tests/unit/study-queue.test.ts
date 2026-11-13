import { describe, expect, it } from "vitest";
import { countGap, MIN_GAP, pickNext, swipeGrade, type QueueSlot } from "@/lib/study-queue";

const slot = (cardId: string, availableAt = 0, gapLeft = 0, urgent = false): QueueSlot => ({
  cardId,
  availableAt,
  gapLeft,
  urgent,
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

  it("zamanı gelen acil kart, sırada önde duran kartların önüne geçer", () => {
    const q = [slot("yeni1"), slot("yeni2"), slot("bilinmeyen", 900, 0, true)];
    expect(pickNext(q, 1000, null)).toEqual({ kind: "card", index: 2 });
  });

  it("acil kart zamanı gelmeden ya da aralığı dolmadan öne geçmez", () => {
    expect(pickNext([slot("a"), slot("b", 5000, 0, true)], 1000, null)).toEqual({
      kind: "card",
      index: 0,
    });
    expect(pickNext([slot("a"), slot("b", 900, 2, true)], 1000, null)).toEqual({
      kind: "card",
      index: 0,
    });
  });

  it("birden fazla acil kart varsa en uzun süredir bekleyen önce gelir", () => {
    const q = [slot("a", 800, 0, true), slot("b", 500, 0, true), slot("c")];
    expect(pickNext(q, 1000, null)).toEqual({ kind: "card", index: 1 });
  });

  it("cevaplanan kart dışındaki kartların aralık sayacı bir azalır, sıfırın altına inmez", () => {
    const q = [slot("a", 0, 2), slot("b", 0, 0), slot("c", 0, 3)];
    expect(countGap(q, "c").map((s) => s.gapLeft)).toEqual([1, 0, 3]);
  });
});

const RETRY = 90_000;

/** Oturumu taklit eder: bilinmeyen kart 90 sn sonraya (acil olarak) döner, bilinen çıkar. */
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
    queue = again.has(card.cardId)
      ? [...rest, slot(card.cardId, now + RETRY, MIN_GAP, true)]
      : rest;
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
    // Aynı kartın iki görünüşü arasında en az 90 sn geçer (eskiden ~5 saniyede geri geliyordu).
    const lastSeen = new Map<string, number>();
    shown.forEach((id, i) => {
      const before = lastSeen.get(id);
      if (before !== undefined) expect(times[i]! - before).toBeGreaterThanOrEqual(RETRY);
      lastSeen.set(id, times[i]!);
    });
  });

  it("çok kart varken yanlış bilinen kart araya en az 3 kart girmeden dönmez", () => {
    const { shown } = simulate(["a", "b", "c", "d", "e", "f"], new Set(["a"]), 20);
    const first = shown.indexOf("a");
    const second = shown.indexOf("a", first + 1);
    expect(second - first - 1).toBeGreaterThanOrEqual(MIN_GAP);
  });

  it("uzun listede bilinmeyen kart liste bitmeden, 90 sn dolar dolmaz geri gelir", () => {
    // 40 kart, her biri ~5 sn. İlk kart bilinmedi (bir kez); eskiden 39 kartın hepsinden sonra
    // (3 dakikadan fazla) geliyordu.
    const cards = Array.from({ length: 40 }, (_, i) => `k${i}`);
    let failedOnce = false;
    const again = {
      has: (id: string) => {
        if (id !== "k0" || failedOnce) return false;
        failedOnce = true;
        return true;
      },
    } as Set<string>;
    const { shown, times } = simulate(cards, again, 60);
    const second = shown.indexOf("k0", 1);
    expect(second).toBeGreaterThan(MIN_GAP);
    expect(times[second]! - times[0]!).toBeGreaterThanOrEqual(RETRY);
    expect(times[second]! - times[0]!).toBeLessThan(RETRY + 10_000);
    // Geri geldiğinde listenin yarısından fazlası hâlâ sırada.
    expect(second).toBeLessThan(25);
    expect(shown).toHaveLength(41);
  });
});

describe("kaydırma yönü", () => {
  it("yeterince sağa çekilen kart bildim, sola çekilen bilmedim", () => {
    expect(swipeGrade(140, 0)).toBe(3);
    expect(swipeGrade(-140, 0)).toBe(1);
  });

  it("az çekilip yavaş bırakılan kart cevap sayılmaz", () => {
    expect(swipeGrade(40, 100)).toBeNull();
    expect(swipeGrade(-40, -100)).toBeNull();
    expect(swipeGrade(0, 2000)).toBeNull();
  });

  it("kısa ama hızlı fiske, fiskenin yönünde cevap sayılır", () => {
    expect(swipeGrade(40, 900)).toBe(3);
    expect(swipeGrade(-40, -900)).toBe(1);
  });

  it("sola çekilmiş kart bırakılırken parmak sağa kaysa da ASLA bildim sayılmaz", () => {
    // Eski hata: hız önce kontrol edildiği için bu durumda 'bildim' kaydediliyordu.
    expect(swipeGrade(-160, 700)).not.toBe(3);
    expect(swipeGrade(-160, 100)).toBe(1);
    expect(swipeGrade(160, -700)).not.toBe(1);
    expect(swipeGrade(160, -100)).toBe(3);
  });

  it("ters yöne hızla geri çekilen kart vazgeçme sayılır", () => {
    expect(swipeGrade(-160, 700)).toBeNull();
    expect(swipeGrade(160, -700)).toBeNull();
    expect(swipeGrade(-15, 900)).toBeNull();
  });
});
