import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/validation/cards";

export type Deck = {
  id: string;
  name: string;
  source_lang: string;
  target_lang: string;
  owner_id: string;
  archived: boolean;
};

export type DeckSummary = {
  id: string;
  name: string;
  source_lang: string;
  target_lang: string;
  archived: boolean;
  role: "owner" | "member";
  card_count: number;
  new_count: number;
  due_count: number;
};

/** Kullanıcının üyesi olduğu desteyi getirir; değilse (veya id bozuksa) 404. */
export async function requireDeck(rawId: string) {
  const parsed = uuidSchema.safeParse(rawId);
  if (!parsed.success) notFound();
  const ctx = await requireUser();
  const { data: deck } = await ctx.supabase
    .from("decks")
    .select("id, name, source_lang, target_lang, owner_id, archived")
    .eq("id", parsed.data)
    .maybeSingle<Deck>();
  if (!deck) notFound();
  return { ...ctx, deck, isOwner: deck.owner_id === ctx.user.id };
}

export async function listDeckSummaries(includeArchived: boolean): Promise<DeckSummary[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc("deck_summaries", { p_include_archived: includeArchived });
  return ((data ?? []) as DeckSummary[]).map((d) => ({
    ...d,
    card_count: Number(d.card_count),
    new_count: Number(d.new_count),
    due_count: Number(d.due_count),
  }));
}
