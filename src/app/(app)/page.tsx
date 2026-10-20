import Link from "next/link";
import { FlameIcon } from "@/components/icons";
import { FadeIn } from "@/components/motion/fade-in";
import { ProgressBar } from "@/components/motion/progress-bar";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { currentStreak } from "@/lib/dates";
import { deckBadge } from "@/lib/deck-badge";
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
      <FadeIn className="flex items-start justify-between gap-3">
        <h1 className="text-5xl leading-[0.95] font-bold tracking-tighter">
          Hi, {profile.display_name}.
          <br />
          {ready > 0 ? "Let’s go." : decks.length === 0 ? "Welcome!" : "Nice work."}
        </h1>
        <span
          className="border-ink bg-yellow text-on-accent shadow-hard-sm mt-1 flex shrink-0 items-center gap-1 rounded-full border-[2.5px] px-3 py-1 font-bold"
          aria-label={`${streak}-day streak`}
        >
          <FlameIcon size={18} />
          {streak}
        </span>
      </FadeIn>

      <FadeIn index={1}>
        <section
          aria-label="Today"
          className={`brutal-card text-on-accent flex flex-col gap-4 p-4 ${
            decks.length === 0 ? "bg-blue" : ready > 0 ? "bg-pink" : "bg-teal"
          }`}
        >
          {decks.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-2">
              <p className="text-2xl font-bold tracking-tight">
                Create your first deck to start studying.
              </p>
              <Link
                href="/decks"
                className="press-sm border-ink bg-yellow inline-flex min-h-11 items-center rounded-xl border-[2.5px] px-4 font-bold"
              >
                Go to Decks
              </Link>
            </div>
          ) : ready > 0 ? (
            <>
              <p className="text-3xl font-bold tracking-tight">
                {ready} {ready === 1 ? "card" : "cards"} today
              </p>
              <dl className="grid grid-cols-3 gap-2">
                <Stat label="Due" value={dueTotal} />
                <Stat label="New" value={newTotal} />
                <Stat label="Streak" value={streak} />
              </dl>
              <StartButton href="/study" count={ready} />
            </>
          ) : (
            <div className="flex flex-col gap-1 py-2">
              <p className="text-3xl font-bold tracking-tight">All caught up!</p>
              <p className="font-medium">
                {tomorrow > 0
                  ? `${tomorrow} ${tomorrow === 1 ? "card" : "cards"} due tomorrow.`
                  : "Nothing due tomorrow. Add new words to keep learning."}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-sm font-bold">
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
        <section aria-labelledby="by-deck" className="flex flex-col gap-3">
          <FadeIn index={2}>
            <h2 id="by-deck" className="text-xl font-bold">
              Study a deck
            </h2>
          </FadeIn>
          <ul className="flex flex-col gap-3">
            {studyable.map((deck, i) => {
              const deckNew = Math.min(deck.new_count, remainingNew);
              const deckReady = deck.due_count + deckNew;
              const badge = deckBadge(deck.name, i);
              return (
                <FadeIn
                  as="li"
                  key={deck.id}
                  index={i + 3}
                  className="brutal-box shadow-hard-sm flex items-center gap-3 p-3"
                >
                  <span
                    aria-hidden="true"
                    className={`border-ink text-on-accent flex size-11 shrink-0 items-center justify-center rounded-lg border-[2.5px] font-bold ${badge.color}`}
                  >
                    {badge.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{deck.name}</p>
                    <p className="text-ink-soft text-sm">
                      {languageLabel(deck.source_lang)} → {languageLabel(deck.target_lang)} ·{" "}
                      {deck.due_count} due · {deckNew} new
                    </p>
                  </div>
                  {deckReady > 0 ? (
                    <Link
                      href={`/study?deck=${deck.id}`}
                      className={buttonClass("secondary", "shrink-0 px-3 text-sm")}
                      aria-label={`Study ${deck.name}`}
                    >
                      Study
                    </Link>
                  ) : (
                    <span className="text-ink-soft shrink-0 text-sm font-bold">Done ✓</span>
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-ink bg-surface text-ink rounded-xl border-[2.5px] px-3 py-2">
      <dt className="text-xs font-bold tracking-wide uppercase">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
    </div>
  );
}
