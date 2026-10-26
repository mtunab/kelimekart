import type { ProgressFields } from "@/lib/srs";

/** Çalışma ekranındaki bir kart (sunucudan gelen satırın uygulamadaki biçimi). */
export type QueueItem = {
  cardId: string;
  deckId: string;
  front: string;
  back: string;
  example: string | null;
  note: string | null;
  sourceLang: string;
  targetLang: string;
  isNew: boolean;
  progress: ProgressFields | null;
};

/** `get_study_queue` ve `get_extra_cards` aynı satırı döndürür. */
export type QueueRow = {
  card_id: string;
  deck_id: string;
  front: string;
  back: string;
  example: string | null;
  note: string | null;
  source_lang: string;
  target_lang: string;
  is_new: boolean;
  progress: (ProgressFields & { version: number }) | null;
};

export function toQueueItem(row: QueueRow): QueueItem {
  return {
    cardId: row.card_id,
    deckId: row.deck_id,
    front: row.front,
    back: row.back,
    example: row.example,
    note: row.note,
    sourceLang: row.source_lang,
    targetLang: row.target_lang,
    isNew: row.is_new,
    progress: row.progress,
  };
}
