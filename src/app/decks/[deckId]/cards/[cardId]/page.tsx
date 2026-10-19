import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { requireDeck } from "@/lib/decks";
import { uuidSchema } from "@/lib/validation/cards";
import { CardEditForm } from "./card-edit-form";

export const metadata: Metadata = { title: "Kartı düzenle · KelimeKart" };

export default async function CardEditPage({
  params,
}: PageProps<"/decks/[deckId]/cards/[cardId]">) {
  const { deckId, cardId } = await params;
  const { supabase, profile, deck } = await requireDeck(deckId);
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
    <PageShell displayName={profile.display_name}>
      <Link
        href={`/decks/${deck.id}`}
        className="self-start rounded-md py-1 text-sm text-indigo-700 dark:text-indigo-300"
      >
        ← {deck.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Kartı düzenle</h1>
      <CardEditForm deck={deck} card={card} />
    </PageShell>
  );
}
