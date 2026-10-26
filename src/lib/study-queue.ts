/**
 * Çalışma oturumunda sıradaki kartı seçen saf kurallar (tarih dışarıdan verilir, yan etki yok).
 *
 * - Bir kart dönüş zamanı (availableAt) gelmeden gösterilmez. Öğrenme adımındaki kart
 *   ("Again" → 1 dk, yeni kelimede "Good" → 10 dk) gerçekten o süreyi bekler.
 * - Cevaplanan kart, araya en az MIN_GAP başka kart girmeden tekrar çıkmaz (gapLeft).
 *   Zamanı gelmiş ama aralığı dolmamış kartlar ancak başka seçenek yoksa gösterilir; o zaman da
 *   mümkünse az önce gösterilen kart değil, öteki seçilir. Böylece iki kart arasında anında
 *   gidip gelme olmaz.
 * - Hiç hazır kart yoksa en erken dönüş zamanına kadar beklenir.
 */
export const MIN_GAP = 3;

export type QueueSlot = { cardId: string; availableAt: number; gapLeft: number };

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
  const clear = ready.find(({ slot }) => slot.gapLeft <= 0);
  if (clear) return { kind: "card", index: clear.index };

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
