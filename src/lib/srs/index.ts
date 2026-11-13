/**
 * Tekrar hesabı: DuoCards'ın basamaklı sistemi (kurallar ve süreler `config.ts` içinde).
 * Hepsi SAF fonksiyon: zaman (`now`) dışarıdan verilir, yan etki yoktur.
 * Girdi ve çıktı doğrudan veritabanındaki `card_progress` satırının alanlarıdır; tarihler UTC (ISO).
 */
import { DAY_MS, DROP_LEVELS, EARLY_GRACE_MS, LADDER_MS, MAX_LEVEL, RETRY_MS } from "./config";

export { LADDER_MS, MAX_LEVEL, RETRY_MS };

/** Cevap: 1 bilmedim, 2 zor bildim, 3 bildim, 4 çok kolay. Telefonda yalnızca 1 ve 3 var. */
export type Grade = 1 | 2 | 3 | 4;

export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;

export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;

/** Kart durumu: 1 = kısa aralıkta (bir günden az bekliyor), 2 = uzun aralıkta (gün ve üzeri). */
export const State = { New: 0, Learning: 1, Review: 2 } as const;

/**
 * Veritabanındaki `card_progress` satırının tekrar alanları (tarihler ISO metin).
 * `learning_steps` kartın BASAMAĞINI tutar (0..MAX_LEVEL). `stability` ve `difficulty` eski
 * sistemden (FSRS) kalmadır; okunmaz, olduğu gibi taşınır.
 */
export type ProgressFields = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
};

export function isGrade(value: unknown): value is Grade {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/** Kartın basamağı. Satır yoksa (kart bu kullanıcı için yeni) 0. */
export function levelOf(row: ProgressFields | null): number {
  if (!row) return 0;
  const level = Math.trunc(Number(row.learning_steps));
  return Number.isFinite(level) ? Math.min(Math.max(level, 0), MAX_LEVEL) : 0;
}

/**
 * Kartı verilen puanla cevaplar ve satırın yeni halini döndürür.
 *
 * - Bilmedim (1): iki basamak iner, 90 sn sonra tekrar sorulur.
 * - Zor (2): basamak değişmez, aynı süre bir kez daha beklenir.
 * - Bildim (3): bir basamak çıkar. Çok kolay (4): iki basamak çıkar.
 * - Zamanından önce (ek alıştırma olarak) bilinen kart basamak atlamaz, zamanı da değişmez.
 */
export function review(row: ProgressFields | null, grade: Grade, now: Date): ProgressFields {
  const nowMs = now.getTime();
  const level = levelOf(row);
  const dueMs = row ? Date.parse(row.due) : nowMs;
  const lastMs = row?.last_review ? Date.parse(row.last_review) : null;

  const base = {
    stability: row?.stability ?? 0,
    difficulty: row?.difficulty ?? 0,
    elapsed_days: lastMs === null ? 0 : Math.max(0, Math.floor((nowMs - lastMs) / DAY_MS)),
    reps: (row?.reps ?? 0) + 1,
    last_review: now.toISOString(),
  };

  const early = row !== null && nowMs < dueMs - EARLY_GRACE_MS;
  if (row && early && grade !== Rating.Again) {
    return {
      ...base,
      due: new Date(dueMs).toISOString(),
      scheduled_days: row.scheduled_days,
      learning_steps: level,
      lapses: row.lapses,
      state: row.state,
    };
  }

  let nextLevel: number;
  let waitMs: number;
  if (grade === Rating.Again) {
    nextLevel = Math.max(0, level - DROP_LEVELS);
    waitMs = RETRY_MS;
  } else if (grade === Rating.Hard) {
    nextLevel = level;
    waitMs = waitOf(level);
  } else {
    nextLevel = Math.min(MAX_LEVEL, level + (grade === Rating.Easy ? 2 : 1));
    waitMs = waitOf(nextLevel);
  }

  return {
    ...base,
    due: new Date(nowMs + waitMs).toISOString(),
    scheduled_days: Math.floor(waitMs / DAY_MS),
    learning_steps: nextLevel,
    // Günlerce aralığa çıkmış bir kartın unutulması "unutma" sayılır.
    lapses: (row?.lapses ?? 0) + (grade === Rating.Again && row?.state === State.Review ? 1 : 0),
    state: waitMs >= DAY_MS ? State.Review : State.Learning,
  };
}

/** Bir basamaktaki kartın bekleme süresi; en alt basamakta (0) kısa tekrar süresi. */
function waitOf(level: number): number {
  return level <= 0 ? RETRY_MS : LADDER_MS[Math.min(level, MAX_LEVEL) - 1]!;
}
