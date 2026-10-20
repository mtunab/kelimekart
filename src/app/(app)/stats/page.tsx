import type { Metadata } from "next";
import { BarChart } from "@/components/bar-chart";
import { FlameIcon } from "@/components/icons";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Stats · KelimeKart" };

type MyStats = {
  reviews_today: number;
  correct_today: number;
  reviews_week: number;
  correct_week: number;
  streak: number;
};
type DayCount = { day: string; reviews?: number; due_count?: number };
type DeckStates = {
  deck_id: string;
  name: string;
  new_count: number;
  learning_count: number;
  mature_count: number;
};
type BoardRow = { display_name: string; reviews_today: number; streak: number; is_me: boolean };

const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function percent(part: number, total: number) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : "—";
}

export default async function StatsPage() {
  const { supabase, profile } = await requireUser();
  const [mine, daily, forecast, decks, board] = await Promise.all([
    supabase.rpc("my_stats").single<MyStats>(),
    supabase.rpc("daily_reviews", { p_days: 7 }),
    supabase.rpc("due_forecast", { p_days: 14 }),
    supabase.rpc("deck_state_counts"),
    supabase.rpc("group_board"),
  ]);

  const s = mine.data;
  const n = (v: unknown) => Number(v ?? 0);
  const week = ((daily.data ?? []) as DayCount[]).map((d) => ({
    label: weekday.format(new Date(`${d.day}T00:00:00Z`)),
    hint: dayMonth.format(new Date(`${d.day}T00:00:00Z`)),
    value: n(d.reviews),
  }));
  const ahead = ((forecast.data ?? []) as DayCount[]).map((d, i) => ({
    label: i === 0 ? "Today" : dayMonth.format(new Date(`${d.day}T00:00:00Z`)),
    hint: dayMonth.format(new Date(`${d.day}T00:00:00Z`)),
    value: n(d.due_count),
  }));
  const deckRows = (decks.data ?? []) as DeckStates[];
  const boardRows = (board.data ?? []) as BoardRow[];

  return (
    <PageShell>
      <h1 className="text-4xl font-bold tracking-tight">Stats</h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Today"
          value={String(n(s?.reviews_today))}
          sub={`goal ${profile.daily_goal_reviews}`}
        />
        <Stat label="Last 7 days" value={String(n(s?.reviews_week))} sub="reviews" />
        <Stat
          label="Accuracy"
          value={percent(n(s?.correct_week), n(s?.reviews_week))}
          sub="last 7 days"
        />
        <Stat
          label="Streak"
          value={`${n(s?.streak)} ${n(s?.streak) === 1 ? "day" : "days"}`}
          sub={n(s?.streak) > 0 ? "keep going" : "start today"}
        />
      </dl>

      <section className="brutal-card p-4">
        <BarChart title="Reviews in the last 7 days" data={week} />
      </section>

      <section className="brutal-card p-4">
        <BarChart title="Next 14 days: cards coming due" data={ahead} color="fill-blue" />
      </section>

      <section aria-labelledby="by-deck" className="flex flex-col gap-2">
        <h2 id="by-deck" className="text-xl font-bold">
          Your cards by deck
        </h2>
        {deckRows.length === 0 ? (
          <p className="text-ink-soft">No decks yet.</p>
        ) : (
          <div className="brutal-card overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-yellow text-on-accent">
                <tr>
                  <th className="p-2">Deck</th>
                  <th className="p-2 text-right">New</th>
                  <th className="p-2 text-right">Learning</th>
                  <th className="p-2 text-right">Mature</th>
                </tr>
              </thead>
              <tbody>
                {deckRows.map((d) => (
                  <tr key={d.deck_id} className="border-ink border-t-[2.5px]">
                    <td className="p-2">{d.name}</td>
                    <td className="p-2 text-right">{n(d.new_count)}</td>
                    <td className="p-2 text-right">{n(d.learning_count)}</td>
                    <td className="p-2 text-right">{n(d.mature_count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-ink-soft text-xs">
          Mature: cards reviewed at intervals of 21 days or more.
        </p>
      </section>

      <section aria-labelledby="group" className="flex flex-col gap-2">
        <h2 id="group" className="text-xl font-bold">
          Group board
        </h2>
        <ol className="brutal-card divide-ink divide-y-[2.5px] overflow-hidden">
          {boardRows.map((row, i) => (
            <li
              key={`${row.display_name}-${i}`}
              className={`flex min-h-12 items-center justify-between gap-2 px-3 ${row.is_me ? "bg-pink text-on-accent font-bold" : ""}`}
            >
              <span>
                <span className={`mr-2 ${row.is_me ? "" : "text-ink-soft"}`}>{i + 1}.</span>
                {row.display_name}
                {row.is_me ? " (you)" : ""}
              </span>
              <span
                className={`flex items-center gap-1 text-sm ${row.is_me ? "" : "text-ink-soft"}`}
              >
                {n(row.reviews_today)} reviews ·
                <FlameIcon size={16} />
                <span className="sr-only">streak</span>
                {n(row.streak)}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-ink-soft text-xs">The board only shows names and numbers.</p>
      </section>
    </PageShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="brutal-box shadow-hard-sm p-3">
      <dt className="text-ink-soft text-sm">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
      <dd className="text-ink-soft text-xs">{sub}</dd>
    </div>
  );
}
