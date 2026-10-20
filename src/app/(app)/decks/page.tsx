import type { Metadata } from "next";
import Link from "next/link";
import { DeckForm } from "@/components/deck-form";
import { FadeIn } from "@/components/motion/fade-in";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listDeckSummaries, type DeckSummary } from "@/lib/decks";
import { deckBadge } from "@/lib/deck-badge";
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
      <h1 className="text-4xl font-bold tracking-tight">Decks</h1>

      <section aria-label="Your decks" className="flex flex-col gap-3">
        {active.length === 0 ? (
          <FadeIn>
            <p className="border-ink text-ink-soft rounded-xl border-[2.5px] border-dashed p-6 text-center font-medium">
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
        <div className="brutal-card p-4">
          <h2 id="new-deck" className="mb-3 text-xl font-bold">
            New deck
          </h2>
          <DeckForm />
        </div>
      </FadeIn>

      <section aria-label="Archive">
        {showArchived ? (
          <>
            <h2 className="mb-2 text-xl font-bold">Archived decks</h2>
            {archived.length === 0 ? (
              <p className="text-ink-soft">No archived decks.</p>
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
  const badge = deckBadge(deck.name, index);
  return (
    <FadeIn
      as="li"
      index={index}
      className="brutal-box shadow-hard-sm flex items-center justify-between gap-3 p-3"
    >
      <span
        aria-hidden="true"
        className={`border-ink text-on-accent flex size-11 shrink-0 items-center justify-center rounded-lg border-[2.5px] font-bold ${badge.color}`}
      >
        {badge.initials}
      </span>
      <Link
        href={`/decks/${deck.id}`}
        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-1 underline-offset-4 hover:underline"
      >
        <span className="truncate font-bold">{deck.name}</span>
        <span className="text-ink-soft text-sm">
          {languageLabel(deck.source_lang)} → {languageLabel(deck.target_lang)} · {deck.card_count}{" "}
          {deck.card_count === 1 ? "card" : "cards"}
          {deck.role === "member" ? " · shared" : ""}
        </span>
      </Link>
      {!deck.archived && deck.card_count > 0 ? (
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {deck.due_count > 0 ? (
            <span className="border-ink bg-blue text-on-accent rounded-full border-2 px-2 py-0.5 font-bold">
              {deck.due_count} due
            </span>
          ) : null}
          {deck.new_count > 0 ? (
            <span className="border-ink bg-teal text-on-accent rounded-full border-2 px-2 py-0.5 font-bold">
              {deck.new_count} new
            </span>
          ) : null}
        </div>
      ) : null}
    </FadeIn>
  );
}
