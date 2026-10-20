import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setDeckArchived } from "@/app/(app)/decks/actions";
import { DeckForm } from "@/components/deck-form";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { requireDeck } from "@/lib/decks";

export const metadata: Metadata = { title: "Deck settings · KelimeKart" };

export default async function DeckSettingsPage({ params }: PageProps<"/decks/[deckId]/settings">) {
  const { deckId } = await params;
  const { deck, isOwner } = await requireDeck(deckId);
  if (!isOwner) notFound();

  return (
    <PageShell>
      <Link
        href={`/decks/${deck.id}`}
        className="self-start rounded-md py-1 text-sm text-indigo-700 dark:text-indigo-300"
      >
        ← {deck.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Deck settings</h1>
      <DeckForm deck={deck} />
      <form action={setDeckArchived} className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <input type="hidden" name="deckId" value={deck.id} />
        <input type="hidden" name="archived" value={String(!deck.archived)} />
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          {deck.archived
            ? "This deck is archived. Restore it to show it in your list and study queue again."
            : "Archiving doesn't delete the deck; it just hides it from your list and study queue."}
        </p>
        <button type="submit" className={buttonClass("secondary")}>
          {deck.archived ? "Restore deck" : "Archive deck"}
        </button>
      </form>
    </PageShell>
  );
}
