/**
 * Çalışma oturumunda sıradaki kartı seçen saf kurallar (tarih dışarıdan verilir, yan etki yok).
 *
 * - Bir kart dönüş zamanı (availableAt) gelmeden gösterilmez: bilinmeyen kart 90 sn bekler.
 * - Cevaplanan kart, araya en az MIN_GAP başka kart girmeden tekrar çıkmaz (gapLeft).
 * - Zamanı gelen "acil" kart (az önce bilinmeyen ya da kısa aralıktaki kart) SIRADAKİ diğer
 *   kartların önüne geçer. (Eskiden listenin sonuna ekleniyor, bilinmeyen kart ancak bütün
 *   liste bittikten sonra geliyordu.)
 * - Zamanı gelmiş ama aralığı dolmamış kartlar ancak başka seçenek yoksa gösterilir; o zaman da
 *   mümkünse az önce gösterilen kart değil, öteki seçilir. Böylece iki kart arasında anında
 *   gidip gelme olmaz.
 * - Hiç hazır kart yoksa en erken dönüş zamanına kadar beklenir.
 */
export const MIN_GAP = 3;

/**
 * Bu süre içinde dönecek kart oturumda kalır ve zamanı gelince tekrar gösterilir (90 sn'lik
 * kartlar). Veritabanındaki `is_study_ready()` aynı süreyi kullanır.
 */
export const LEARN_AHEAD_MS = 2 * 60_000;

export type QueueSlot = {
  cardId: string;
  availableAt: number;
  gapLeft: number;
  /** Kısa aralıktaki kart: zamanı gelince sıradaki yeni/tekrar kartlarının önüne geçer. */
  urgent: boolean;
};

export type Pick =
  { kind: "card"; index: number } | { kind: "wait"; until: number } | { kind: "empty" };

export function pickNext(
  queue: readonly QueueSlot[],
  now: number,
  lastCardId: string | null,
): Pick {
  if (queue.length === 0) return { kind: "empty" };
  const ready = queue.flatMap((slot, index) => (slot.availableAt <= now ? [{ slot, index }] : []));
  if (ready.length === 0) {
    return { kind: "wait", until: Math.min(...queue.map((slot) => slot.availableAt)) };
  }
  const clear = ready.filter(({ slot }) => slot.gapLeft <= 0);
  const urgent = clear.filter(({ slot }) => slot.urgent);
  if (urgent.length > 0) {
    // En uzun süredir bekleyen acil kart önce.
    const first = urgent.reduce((a, b) => (b.slot.availableAt < a.slot.availableAt ? b : a));
    return { kind: "card", index: first.index };
  }
  if (clear[0]) return { kind: "card", index: clear[0].index };

  const others = ready.filter(({ slot }) => slot.cardId !== lastCardId);
  const pool = others.length > 0 ? others : ready;
  const best = pool.reduce((a, b) =>
    b.slot.gapLeft < a.slot.gapLeft ||
    (b.slot.gapLeft === a.slot.gapLeft && b.slot.availableAt < a.slot.availableAt)
      ? b
      : a,
  );
  return { kind: "card", index: best.index };
}

/** Bir kart cevaplanınca diğer kartların "araya girecek kart" sayacı bir azalır. */
export function countGap<T extends QueueSlot>(queue: readonly T[], answeredCardId: string): T[] {
  return queue.map((slot) =>
    slot.cardId === answeredCardId || slot.gapLeft <= 0
      ? slot
      : { ...slot, gapLeft: slot.gapLeft - 1 },
  );
}

const SWIPE_DISTANCE = 100;
const SWIPE_VELOCITY = 600;
/** Hızlı fiske için en az bu kadar yol alınmış olmalı. */
const FLICK_MIN_DISTANCE = 20;
/** Kart bırakılırken ters yöne bu hızla çekiliyorsa kullanıcı vazgeçmiştir. */
const CANCEL_VELOCITY = 300;

/**
 * Kart bırakıldığında kaydırmanın anlamı: 3 = bildim (sağ), 1 = bilmedim (sol), null = cevap yok.
 * Yön her zaman kartın DURDUĞU tarafa göre belirlenir; ekrandaki GOOD/AGAIN damgasıyla aynıdır.
 * (Eskiden önce hıza bakılıyordu: sola çekilip bırakılırken parmak hafifçe sağa kayarsa
 * "bilmedim" yerine "bildim" kaydediliyordu.)
 */
export function swipeGrade(offsetX: number, velocityX: number): 1 | 3 | null {
  const direction = Math.sign(offsetX);
  if (direction === 0) return null;
  const along = velocityX * direction;
  if (along < -CANCEL_VELOCITY) return null;
  const distance = Math.abs(offsetX);
  const far = distance > SWIPE_DISTANCE;
  const flick = distance > FLICK_MIN_DISTANCE && along > SWIPE_VELOCITY;
  if (!far && !flick) return null;
  return direction > 0 ? 3 : 1;
}
