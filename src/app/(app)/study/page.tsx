import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import type { ProgressFields } from "@/lib/srs";
import { uuidSchema } from "@/lib/validation/cards";
import { StudySession, type QueueItem } from "./study-session";

export const metadata: Metadata = { title: "Study · KelimeKart" };

type QueueRow = {
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

type TodayRow = { reviews_today: number; daily_goal: number };

export default async function StudyPage({ searchParams }: PageProps<"/study">) {
  const [{ supabase, profile }, params] = await Promise.all([requireUser(), searchParams]);
  const deckParam = uuidSchema.safeParse(params.deck);
  const deckId = deckParam.success ? deckParam.data : null;

  const [queueResult, todayResult, deckResult] = await Promise.all([
    supabase.rpc("get_study_queue", { p_deck_id: deckId }),
    supabase.rpc("study_today").single<TodayRow>(),
    deckId
      ? supabase.from("decks").select("name").eq("id", deckId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const queue: QueueItem[] = ((queueResult.data ?? []) as QueueRow[]).map((row) => ({
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
  }));
  const deckName = (deckResult.data as { name: string } | null)?.name ?? null;

  return (
    // Telefonda çalışma ekranı kaydırma olmadan tek ekrana sığar: yükseklik = ekran - üst çubuk;
    // kart kalan boşluğu doldurur. Altta yüzen menü için boşluk bırakılır.
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pt-3 pb-[calc(6.5rem+env(safe-area-inset-bottom))] max-sm:h-[calc(100dvh-4rem)] max-sm:overflow-hidden sm:flex-1 sm:gap-6 sm:pt-6 sm:pb-8">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={deckId ? `/decks/${deckId}` : "/"}
          className="rounded-lg py-1 text-sm font-bold underline decoration-2 underline-offset-4"
        >
          ← {deckName ?? "Home"}
        </Link>
        <span className="text-ink-soft text-sm">{deckName ? "This deck" : "All decks"}</span>
      </div>
      {queueResult.error ? (
        <p
          role="alert"
          className="border-ink bg-red text-on-accent rounded-xl border-[2.5px] p-3 font-bold"
        >
          Couldn&apos;t load your cards. Check your connection and refresh the page.
        </p>
      ) : (
        <StudySession
          initialQueue={queue}
          reviewsToday={Number(todayResult.data?.reviews_today ?? 0)}
          dailyGoal={Number(todayResult.data?.daily_goal ?? profile.daily_goal_reviews)}
          backHref={deckId ? `/decks/${deckId}` : "/"}
        />
      )}
    </main>
  );
}
