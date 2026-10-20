import type { Metadata } from "next";
import Link from "next/link";
import { DeckForm } from "@/components/deck-form";
import { FadeIn } from "@/components/motion/fade-in";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listDeckSummaries, type DeckSummary } from "@/lib/decks";
import { languageLabel } from "@/lib/languages";

export const metadata: Metadata = { title: "Decks · KelimeKart" };

const notices: Record<string, string> = {
  left: "You left the deck.",
};

export default async function DecksPage({ searchParams }: PageProps<"/decks">) {
  const [, params] = await Promise.all([requireUser(), searchParams]);
  const showArchived = params.archived === "1";
  const decks = await listDeckSummaries(showArchived);
  const notice = typeof params.status === "string" ? notices[params.status] : undefined;
  const active = decks.filter((d) => !d.archived);
  const archived = decks.filter((d) => d.archived);

  return (
    <PageShell>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <h1 className="text-2xl font-semibold tracking-tight">Decks</h1>

      <section aria-label="Your decks" className="flex flex-col gap-3">
        {active.length === 0 ? (
          <FadeIn>
            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              No decks yet. Create your first deck below, then start adding words.
            </p>
          </FadeIn>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((deck, i) => (
              <DeckRow key={deck.id} deck={deck} index={i} />
            ))}
          </ul>
        )}
      </section>

      <FadeIn as="section" index={active.length + 1}>
        <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 id="new-deck" className="mb-3 text-lg font-semibold">
            New deck
          </h2>
          <DeckForm />
        </div>
      </FadeIn>

      <section aria-label="Archive">
        {showArchived ? (
          <>
            <h2 className="mb-2 text-lg font-semibold">Archived decks</h2>
            {archived.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">No archived decks.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {archived.map((deck, i) => (
                  <DeckRow key={deck.id} deck={deck} index={i} />
                ))}
              </ul>
            )}
            <Link href="/decks" className={buttonClass("ghost", "mt-2 text-sm")}>
              Hide archive
            </Link>
          </>
        ) : (
          <Link href="/decks?archived=1" className={buttonClass("ghost", "text-sm")}>
            Show archived decks
          </Link>
        )}
      </section>
    </PageShell>
  );
}

function DeckRow({ deck, index }: { deck: DeckSummary; index: number }) {
  return (
    <FadeIn
      as="li"
      index={index}
      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      <Link
        href={`/decks/${deck.id}`}
        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-1"
      >
        <span className="truncate font-medium">{deck.name}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {languageLabel(deck.source_lang)} → {languageLabel(deck.target_lang)} · {deck.card_count}{" "}
          {deck.card_count === 1 ? "card" : "cards"}
          {deck.role === "member" ? " · shared" : ""}
        </span>
      </Link>
      {!deck.archived && deck.card_count > 0 ? (
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {deck.due_count > 0 ? (
            <span className="rounded-full bg-indigo-100 px-2 py-1 font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              {deck.due_count} due
            </span>
          ) : null}
          {deck.new_count > 0 ? (
            <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
              {deck.new_count} new
            </span>
          ) : null}
        </div>
      ) : null}
    </FadeIn>
  );
}
