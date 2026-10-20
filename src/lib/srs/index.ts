/**
 * ts-fsrs sarmalayıcı. Hepsi SAF fonksiyon: zaman (`now`) dışarıdan verilir, yan etki yoktur.
 * Veritabanı satırı ↔ ts-fsrs `Card` dönüşümü de burada. Tarihler UTC (ISO) saklanır.
 */
import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card,
  type Grade,
} from "ts-fsrs";
import { SRS_CONFIG } from "./config";

export { Rating, State };
export type { Card, Grade };

export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;

export const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Again]: "Again",
  [Rating.Hard]: "Hard",
  [Rating.Good]: "Good",
  [Rating.Easy]: "Easy",
};

const scheduler = fsrs(
  generatorParameters({
    request_retention: SRS_CONFIG.requestRetention,
    enable_fuzz: SRS_CONFIG.enableFuzz,
    maximum_interval: SRS_CONFIG.maximumIntervalDays,
  }),
);

/** Veritabanındaki `card_progress` satırının FSRS alanları (tarihler ISO metin). */
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

/** Satır yoksa (kart bu kullanıcı için yeni) boş bir FSRS kartı üretir. */
export function toFsrsCard(row: ProgressFields | null, now: Date): Card {
  if (!row) return createEmptyCard(now);
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  };
}

export function fromFsrsCard(card: Card): ProgressFields {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** Kartı verilen puanla cevaplar ve yeni halini döndürür. */
export function review(card: Card, grade: Grade, now: Date): Card {
  return scheduler.next(card, now, grade).card;
}

/** Dört butonun her biri için kartın bir sonraki vadesi. */
export function previewDueDates(card: Card, now: Date): Record<Grade, Date> {
  const preview = scheduler.repeat(card, now);
  return {
    [Rating.Again]: preview[Rating.Again].card.due,
    [Rating.Hard]: preview[Rating.Hard].card.due,
    [Rating.Good]: preview[Rating.Good].card.due,
    [Rating.Easy]: preview[Rating.Easy].card.due,
  };
}

/** İki an arasındaki süreyi kısa metne çevirir: "1m", "10m", "3h", "4d", "2mo", "1.5y". */
export function formatInterval(from: Date, to: Date): string {
  const minutes = Math.max(1, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  const years = Math.round((days / 365) * 10) / 10;
  return `${years}y`;
}
