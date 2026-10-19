import { NextResponse } from "next/server";
import { requireDeck } from "@/lib/decks";
import { cardsToCsv, csvFileName, type ExportCard } from "@/lib/import/csv";

/** Desteyi CSV olarak indirir (arşivdeki kartlar hariç). */
export async function GET(_request: Request, { params }: RouteContext<"/decks/[deckId]/export">) {
  const { deckId } = await params;
  const { supabase, deck } = await requireDeck(deckId);

  const cards: ExportCard[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cards")
      .select("front, back, example, note, tags")
      .eq("deck_id", deck.id)
      .eq("archived", false)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) return new NextResponse("Dışa aktarma başarısız.", { status: 500 });
    cards.push(...data);
    if (data.length < 1000) break;
  }

  const fileName = csvFileName(deck.name);
  return new NextResponse(cardsToCsv(cards), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
