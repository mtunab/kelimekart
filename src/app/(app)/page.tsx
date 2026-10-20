import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { ProgressBar } from "@/components/motion/progress-bar";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { currentStreak } from "@/lib/dates";
import { listDeckSummaries } from "@/lib/decks";
import { languageLabel } from "@/lib/languages";
import { StartButton } from "./start-button";

type TodayRow = {
  reviews_today: number;
  new_today: number;
  daily_goal: number;
  daily_new_limit: number;
  streak_count: number;
  streak_last_day: string | null;
  today: string;
};

/** Ana sayfa = çalışma başlangıç ekranı: bugün ne var, hedef, seri ve "Start studying". */
export default async function StudyHome() {
  const { supabase, profile } = await requireUser();
  const [decks, todayResult, forecastResult] = await Promise.all([
    listDeckSummaries(false),
    supabase.rpc("study_today").single<TodayRow>(),
    supabase.rpc("due_forecast", { p_days: 2 }),
  ]);

  const t = todayResult.data;
  const n = (v: unknown) => Number(v ?? 0);
  const reviewsToday = n(t?.reviews_today);
  const goal = n(t?.daily_goal) || profile.daily_goal_reviews;
  const remainingNew = Math.max(0, n(t?.daily_new_limit) - n(t?.new_today));
  const streak = t
    ? currentStreak({ count: n(t.streak_count), lastDay: t.streak_last_day }, t.today)
    : 0;
  const tomorrow = n(((forecastResult.data ?? []) as { due_count: number }[])[1]?.due_count);

  const dueTotal = decks.reduce((sum, d) => sum + d.due_count, 0);
  const newTotal = Math.min(
    remainingNew,
    decks.reduce((sum, d) => sum + d.new_count, 0),
  );
  const ready = dueTotal + newTotal;
  const studyable = decks.filter((d) => d.card_count > 0);

  return (
    <PageShell width="max-w-xl">
      <FadeIn>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Today</p>
        <h1 className="text-3xl font-semibold tracking-tight">Hi, {profile.display_name} 👋</h1>
      </FadeIn>

      <FadeIn index={1}>
        <section
          aria-label="Today"
          className="flex flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
        >
          {decks.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <p className="text-4xl" aria-hidden="true">
                🗂️
              </p>
              <p className="text-lg font-medium">Create your first deck to start studying.</p>
              <Link href="/decks" className={buttonClass("primary")}>
                Go to Decks
              </Link>
            </div>
          ) : ready > 0 ? (
            <>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Due" value={dueTotal} tone="text-indigo-700 dark:text-indigo-300" />
                <Stat label="New" value={newTotal} tone="text-green-700 dark:text-green-300" />
                <Stat label="Streak" value={streak} suffix=" 🔥" />
              </dl>
              <StartButton href="/study" count={ready} />
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <p className="text-4xl" aria-hidden="true">
                🎉
              </p>
              <p className="text-lg font-semibold">All caught up!</p>
              <p className="text-zinc-600 dark:text-zinc-400">
                {tomorrow > 0
                  ? `${tomorrow} ${tomorrow === 1 ? "card" : "cards"} due tomorrow.`
                  : "Nothing due tomorrow. Add new words to keep learning."}
              </p>
              {streak > 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">🔥 {streak}-day streak</p>
              ) : null}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>Daily goal</span>
              <span>
                {reviewsToday} / {goal} reviews
              </span>
            </div>
            <ProgressBar value={reviewsToday} max={goal} label="Daily goal" />
          </div>
        </section>
      </FadeIn>

      {studyable.length > 0 ? (
        <section aria-labelledby="by-deck" className="flex flex-col gap-2">
          <FadeIn index={2}>
            <h2 id="by-deck" className="text-lg font-semibold">
              Study a deck
            </h2>
          </FadeIn>
          <ul className="flex flex-col gap-2">
            {studyable.map((deck, i) => {
              const deckNew = Math.min(deck.new_count, remainingNew);
              const deckReady = deck.due_count + deckNew;
              return (
                <FadeIn
                  as="li"
                  key={deck.id}
                  index={i + 3}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{deck.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {languageLabel(deck.source_lang)} → {languageLabel(deck.target_lang)} ·{" "}
                      {deck.due_count} due · {deckNew} new
                    </p>
                  </div>
                  {deckReady > 0 ? (
                    <Link
                      href={`/study?deck=${deck.id}`}
                      className={buttonClass("secondary", "shrink-0 text-sm")}
                      aria-label={`Study ${deck.name}`}
                    >
                      Study
                    </Link>
                  ) : (
                    <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
                      Done ✓
                    </span>
                  )}
                </FadeIn>
              );
            })}
          </ul>
        </section>
      ) : null}
    </PageShell>
  );
}

function Stat({
  label,
  value,
  tone = "",
  suffix = "",
}: {
  label: string;
  value: number;
  tone?: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-950">
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`text-2xl font-semibold ${tone}`}>
        {value}
        {suffix}
      </dd>
    </div>
  );
}
