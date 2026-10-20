import type { Metadata } from "next";
import { BarChart } from "@/components/bar-chart";
import { PageShell } from "@/components/page-shell";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "İstatistik · KelimeKart" };

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

const weekday = new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function percent(part: number, total: number) {
  return total > 0 ? `%${Math.round((part / total) * 100)}` : "—";
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
    label: i === 0 ? "Bugün" : dayMonth.format(new Date(`${d.day}T00:00:00Z`)).replace(" ", " "),
    hint: dayMonth.format(new Date(`${d.day}T00:00:00Z`)),
    value: n(d.due_count),
  }));
  const deckRows = (decks.data ?? []) as DeckStates[];
  const boardRows = (board.data ?? []) as BoardRow[];

  return (
    <PageShell displayName={profile.display_name}>
      <h1 className="text-2xl font-semibold tracking-tight">İstatistik</h1>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Bugün"
          value={String(n(s?.reviews_today))}
          sub={`hedef ${profile.daily_goal_reviews}`}
        />
        <Stat label="Son 7 gün" value={String(n(s?.reviews_week))} sub="tekrar" />
        <Stat
          label="Doğruluk"
          value={percent(n(s?.correct_week), n(s?.reviews_week))}
          sub="son 7 gün"
        />
        <Stat
          label="Seri"
          value={`${n(s?.streak)} gün`}
          sub={n(s?.streak) > 0 ? "🔥 devam" : "bugün başla"}
        />
      </dl>

      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <BarChart title="Son 7 günün tekrarları" data={week} />
      </section>

      <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <BarChart
          title="Önümüzdeki 14 gün: vadesi gelecek kartlar"
          data={ahead}
          color="fill-sky-500"
        />
      </section>

      <section aria-labelledby="desteler" className="flex flex-col gap-2">
        <h2 id="desteler" className="text-lg font-semibold">
          Destelere göre kartların
        </h2>
        {deckRows.length === 0 ? (
          <p className="text-zinc-600 dark:text-zinc-400">Henüz deste yok.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="p-2">Deste</th>
                  <th className="p-2 text-right">Yeni</th>
                  <th className="p-2 text-right">Öğreniliyor</th>
                  <th className="p-2 text-right">Olgun</th>
                </tr>
              </thead>
              <tbody>
                {deckRows.map((d) => (
                  <tr key={d.deck_id} className="border-t border-zinc-200 dark:border-zinc-800">
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
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Olgun: 21 gün ve daha uzun aralıkla tekrar edilen kartlar.
        </p>
      </section>

      <section aria-labelledby="grup" className="flex flex-col gap-2">
        <h2 id="grup" className="text-lg font-semibold">
          Grup panosu
        </h2>
        <ol className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {boardRows.map((row, i) => (
            <li
              key={`${row.display_name}-${i}`}
              className={`flex min-h-12 items-center justify-between gap-2 px-3 ${row.is_me ? "bg-indigo-50 dark:bg-indigo-950/40" : ""}`}
            >
              <span>
                <span className="mr-2 text-zinc-500 dark:text-zinc-400">{i + 1}.</span>
                {row.display_name}
                {row.is_me ? " (sen)" : ""}
              </span>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {n(row.reviews_today)} tekrar · 🔥 {n(row.streak)}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Panoda sadece adlar ve sayılar görünür.
        </p>
      </section>
    </PageShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
      <dd className="text-xs text-zinc-500 dark:text-zinc-400">{sub}</dd>
    </div>
  );
}
