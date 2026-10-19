"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { field, type FormState } from "@/lib/form-state";
import { normalizeFront } from "@/lib/import/parse";
import { firstError } from "@/lib/validation/auth";
import {
  cardInputSchema,
  deckInputSchema,
  importRowsSchema,
  uuidSchema,
} from "@/lib/validation/cards";

const GENERIC_ERROR = "Bir şeyler ters gitti. Biraz sonra tekrar dene.";

function deckPath(deckId: string) {
  return `/decks/${deckId}`;
}

// ---------------------------------------------------------------------------
// Desteler
// ---------------------------------------------------------------------------

export async function createDeck(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = {
    name: field(formData, "name"),
    source_lang: field(formData, "source_lang"),
    target_lang: field(formData, "target_lang"),
  };
  const parsed = deckInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_deck", {
    p_name: parsed.data.name,
    p_source_lang: parsed.data.source_lang,
    p_target_lang: parsed.data.target_lang,
  });
  if (error || !data) return { error: GENERIC_ERROR, values };

  revalidatePath("/");
  redirect(deckPath(data as string));
}

export async function updateDeck(_prev: FormState, formData: FormData): Promise<FormState> {
  const deckId = uuidSchema.safeParse(field(formData, "deckId"));
  const values = {
    name: field(formData, "name"),
    source_lang: field(formData, "source_lang"),
    target_lang: field(formData, "target_lang"),
  };
  const parsed = deckInputSchema.safeParse(values);
  if (!deckId.success) return { error: GENERIC_ERROR };
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("decks")
    .update(parsed.data)
    .eq("id", deckId.data)
    .select("id");
  if (error || !data?.length) return { error: "Desteyi sadece sahibi düzenleyebilir.", values };

  revalidatePath("/");
  revalidatePath(deckPath(deckId.data));
  return { success: "Kaydedildi." };
}

export async function setDeckArchived(formData: FormData) {
  const deckId = uuidSchema.parse(field(formData, "deckId"));
  const archived = field(formData, "archived") === "true";
  const { supabase } = await requireUser();
  await supabase.from("decks").update({ archived }).eq("id", deckId);
  revalidatePath("/");
  revalidatePath(deckPath(deckId));
}

// ---------------------------------------------------------------------------
// Kartlar
// ---------------------------------------------------------------------------

export type QuickAddResult =
  { ok: true; front: string } | { ok: false; error: string; duplicate?: boolean };

/** Hızlı ekleme: ön + arka. Aynı kelime varsa ezmez, "zaten var" der. */
export async function quickAddCard(
  deckId: string,
  input: { front: string; back: string },
): Promise<QuickAddResult> {
  const id = uuidSchema.safeParse(deckId);
  const parsed = cardInputSchema.safeParse({ front: input.front, back: input.back });
  if (!id.success) return { ok: false, error: GENERIC_ERROR };
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { supabase } = await requireUser();
  const { error } = await supabase.from("cards").insert({ deck_id: id.data, ...parsed.data });
  if (error?.code === "23505") {
    return { ok: false, duplicate: true, error: `"${parsed.data.front}" bu destede zaten var.` };
  }
  if (error) return { ok: false, error: GENERIC_ERROR };

  // Liste yenilemesini istemci (yazma durunca bir kez) yapar; burada sadece ana sayfayı tazele.
  revalidatePath("/");
  return { ok: true, front: parsed.data.front };
}

export async function updateCard(_prev: FormState, formData: FormData): Promise<FormState> {
  const deckId = uuidSchema.safeParse(field(formData, "deckId"));
  const cardId = uuidSchema.safeParse(field(formData, "cardId"));
  const values = {
    front: field(formData, "front"),
    back: field(formData, "back"),
    example: field(formData, "example"),
    note: field(formData, "note"),
    tags: field(formData, "tags"),
  };
  if (!deckId.success || !cardId.success) return { error: GENERIC_ERROR, values };
  const parsed = cardInputSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("cards")
    .update(parsed.data)
    .eq("id", cardId.data)
    .eq("deck_id", deckId.data)
    .select("id");
  if (error?.code === "23505") {
    return { error: `"${parsed.data.front}" bu destede zaten var.`, values };
  }
  if (error || !data?.length) return { error: GENERIC_ERROR, values };

  revalidatePath(deckPath(deckId.data));
  redirect(`${deckPath(deckId.data)}?durum=kaydedildi`);
}

export async function setCardArchived(formData: FormData) {
  const deckId = uuidSchema.parse(field(formData, "deckId"));
  const cardId = uuidSchema.parse(field(formData, "cardId"));
  const archived = field(formData, "archived") === "true";
  const { supabase } = await requireUser();
  await supabase.from("cards").update({ archived }).eq("id", cardId).eq("deck_id", deckId);
  revalidatePath(deckPath(deckId));
  revalidatePath("/");
}

// ---------------------------------------------------------------------------
// İçe aktarma
// ---------------------------------------------------------------------------

/** Önizleme için: verilen kelimelerden hangileri destede zaten var? */
export async function findExistingFronts(deckId: string, fronts: string[]): Promise<string[]> {
  const id = uuidSchema.safeParse(deckId);
  if (!id.success || fronts.length === 0) return [];
  const { supabase } = await requireUser();
  const wanted = new Set(fronts.slice(0, 2000).map((f) => normalizeFront(f)));
  const existing: string[] = [];
  // Destedeki tüm ön yüzleri sayfa sayfa oku (1000'lik bloklar).
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("cards")
      .select("front")
      .eq("deck_id", id.data)
      .range(from, from + 999);
    for (const row of data ?? []) {
      const key = normalizeFront(row.front);
      if (wanted.has(key)) existing.push(key);
    }
    if (!data || data.length < 1000) break;
  }
  return existing;
}

export type ImportResult =
  { ok: true; inserted: number; skipped: number } | { ok: false; error: string };

/** Onaylanan satırları TEK işlemde ekler; var olan kelimeler atlanır. */
export async function importCards(deckId: string, rows: unknown): Promise<ImportResult> {
  const id = uuidSchema.safeParse(deckId);
  const parsed = importRowsSchema.safeParse(rows);
  if (!id.success) return { ok: false, error: GENERIC_ERROR };
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("import_cards", {
    p_deck_id: id.data,
    p_cards: parsed.data,
  });
  if (error) return { ok: false, error: GENERIC_ERROR };

  revalidatePath(deckPath(id.data));
  revalidatePath("/");
  const result = data as { inserted: number; skipped: number };
  return { ok: true, inserted: result.inserted, skipped: result.skipped };
}

// ---------------------------------------------------------------------------
// Üyeler
// ---------------------------------------------------------------------------

export async function addMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const deckId = uuidSchema.safeParse(field(formData, "deckId"));
  const userId = uuidSchema.safeParse(field(formData, "userId"));
  if (!deckId.success || !userId.success) return { error: "Bir kişi seç." };

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("deck_members")
    .insert({ deck_id: deckId.data, user_id: userId.data, role: "member" });
  if (error?.code === "23505") return { error: "Bu kişi zaten üye." };
  if (error) return { error: "Üyeleri sadece deste sahibi ekleyebilir." };

  revalidatePath(`${deckPath(deckId.data)}/members`);
  return { success: "Üye eklendi." };
}

export async function removeMember(formData: FormData) {
  const deckId = uuidSchema.parse(field(formData, "deckId"));
  const userId = uuidSchema.parse(field(formData, "userId"));
  const { supabase, user } = await requireUser();
  await supabase.from("deck_members").delete().eq("deck_id", deckId).eq("user_id", userId);
  if (userId === user.id) {
    revalidatePath("/");
    redirect("/?durum=ayrildin");
  }
  revalidatePath(`${deckPath(deckId)}/members`);
}
