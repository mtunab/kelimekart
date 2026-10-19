"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fromFsrsCard, review, toFsrsCard, type ProgressFields } from "@/lib/srs";
import { reviewInputSchema, undoInputSchema } from "@/lib/validation/study";

export type SubmitReviewResult =
  | { ok: true; logId: number | null; progress: ProgressFields | null }
  | { ok: false; error: string };

type ProgressRow = ProgressFields & { version: number };

/**
 * Cevabı işler. İstemciden yalnızca cardId, rating, clientEventId gelir.
 * Sunucu mevcut durumu okur, ts-fsrs ile yeni durumu hesaplar; veritabanı fonksiyonu
 * ilerleme güncellemesi + kayıt eklemeyi tek işlemde yapar. Aynı clientEventId tekrar
 * gelirse hiçbir şey değişmez.
 */
export async function submitReview(input: unknown): Promise<SubmitReviewResult> {
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Geçersiz cevap." };
  const { cardId, rating, clientEventId } = parsed.data;
  const { supabase } = await requireUser();

  // Aynı kart için eşzamanlı başka bir cevap araya girerse (sürüm çakışması) bir kez daha dene.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: row, error: readError } = await supabase
      .from("card_progress")
      .select(
        "due, stability, difficulty, elapsed_days, scheduled_days, learning_steps, reps, lapses, state, last_review, version",
      )
      .eq("card_id", cardId)
      .maybeSingle<ProgressRow>();
    if (readError) return { ok: false, error: "Cevap kaydedilemedi." };

    const now = new Date();
    const next = review(toFsrsCard(row, now), rating, now);
    const nextFields = fromFsrsCard(next);

    const { data, error } = await supabase.rpc("apply_review", {
      p_card_id: cardId,
      p_client_event_id: clientEventId,
      p_rating: rating,
      p_reviewed_at: now.toISOString(),
      p_expected_version: row?.version ?? 0,
      p_next: nextFields,
    });
    if (error) return { ok: false, error: "Cevap kaydedilemedi." };

    const result = data as { status: string; log_id?: number };
    if (result.status === "applied") {
      return { ok: true, logId: result.log_id ?? null, progress: nextFields };
    }
    if (result.status === "duplicate") {
      return { ok: true, logId: result.log_id ?? null, progress: null };
    }
    // "conflict": yeniden oku ve tekrar hesapla.
  }
  return { ok: false, error: "Kart başka bir yerde de cevaplandı. Sayfayı yenile." };
}

export type UndoResult = { ok: true } | { ok: false; error: string };

export async function undoReview(input: unknown): Promise<UndoResult> {
  const parsed = undoInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Geri alınamadı." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("undo_review", { p_log_id: parsed.data.logId });
  if (error) return { ok: false, error: "Geri alınamadı." };
  const status = (data as { status: string }).status;
  if (status === "undone" || status === "duplicate") return { ok: true };
  return { ok: false, error: "Bu kart sonradan tekrar cevaplandığı için geri alınamıyor." };
}

/** Oturum sonunda: sayılar ve yarının tahmini yükü. */
export async function sessionSummary() {
  const { supabase } = await requireUser();
  const [today, forecast] = await Promise.all([
    supabase.rpc("study_today").single(),
    supabase.rpc("due_forecast", { p_days: 2 }),
  ]);
  revalidatePath("/");
  const rows = (forecast.data ?? []) as { day: string; due_count: number }[];
  const t = today.data as { reviews_today: number; streak_count: number } | null;
  return {
    reviewsToday: Number(t?.reviews_today ?? 0),
    streak: Number(t?.streak_count ?? 0),
    tomorrowDue: Number(rows[1]?.due_count ?? 0),
  };
}
