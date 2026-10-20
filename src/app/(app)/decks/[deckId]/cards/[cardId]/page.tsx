import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { requireDeck } from "@/lib/decks";
import { uuidSchema } from "@/lib/validation/cards";
import { CardEditForm } from "./card-edit-form";

export const metadata: Metadata = { title: "Edit card · KelimeKart" };

export default async function CardEditPage({
  params,
}: PageProps<"/decks/[deckId]/cards/[cardId]">) {
  const { deckId, cardId } = await params;
  const { supabase, deck } = await requireDeck(deckId);
  const id = uuidSchema.safeParse(cardId);
  if (!id.success) notFound();

  const { data: card } = await supabase
    .from("cards")
    .select("id, front, back, example, note, tags, archived")
    .eq("id", id.data)
    .eq("deck_id", deck.id)
    .maybeSingle();
  if (!card) notFound();

  return (
    <PageShell>
      <Link
        href={`/decks/${deck.id}`}
        className="self-start rounded-lg py-1 text-sm font-bold underline decoration-2 underline-offset-4"
      >
        ← {deck.name}
      </Link>
      <h1 className="text-4xl font-bold tracking-tight">Edit card</h1>
      <CardEditForm deck={deck} card={card} />
    </PageShell>
  );
}
