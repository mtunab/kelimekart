import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
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
    <PageShell width="max-w-xl">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={deckId ? `/decks/${deckId}` : "/"}
          className="rounded-md py-1 text-sm text-indigo-700 dark:text-indigo-300"
        >
          ← {deckName ?? "Home"}
        </Link>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {deckName ? "This deck" : "All decks"}
        </span>
      </div>
      {queueResult.error ? (
        <p role="alert" className="text-red-700 dark:text-red-300">
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
    </PageShell>
  );
}
