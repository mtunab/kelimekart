import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fromFsrsCard, review, toFsrsCard, type Grade } from "@/lib/srs";
import {
  anonClient,
  assertNotProd,
  createTestUser,
  deleteLeftoverTestUsers,
  deleteTestUsers,
  hasDevEnv,
  type TestUser,
  withRetry,
} from "./helpers";

/** Sunucunun yaptığı gibi: mevcut durumu oku, FSRS ile hesapla, apply_review ile yaz. */
async function answer(user: TestUser, cardId: string, grade: Grade, overrideDue?: Date) {
  const { data: row } = await withRetry(() =>
    user.client.from("card_progress").select("*").eq("card_id", cardId).maybeSingle(),
  );
  const now = new Date();
  const next = fromFsrsCard(review(toFsrsCard(row, now), grade, now));
  if (overrideDue) next.due = overrideDue.toISOString();
  const { error } = await withRetry(() =>
    user.client.rpc("apply_review", {
      p_card_id: cardId,
      p_client_event_id: crypto.randomUUID(),
      p_rating: grade,
      p_reviewed_at: now.toISOString(),
      p_expected_version: row?.version ?? 0,
      p_next: next,
    }),
  );
  if (error) throw new Error(error.message);
}

type Row = { card_id: string; is_new: boolean };

describe.skipIf(!hasDevEnv)("çalışma akışı: ana sayfa sayıları ve ek kartlar", () => {
  let ayse: TestUser;
  let baris: TestUser;
  let deckId: string;
  let barisCardId: string;
  const ids: Record<string, string> = {};

  const queue = async () => {
    const { data, error } = await ayse.client.rpc("get_study_queue", { p_deck_id: deckId });
    if (error) throw new Error(error.message);
    return data as Row[];
  };
  const extra = async (exclude: string[], limit = 5) => {
    const { data, error } = await ayse.client.rpc("get_extra_cards", {
      p_deck_id: deckId,
      p_exclude: exclude,
      p_limit: limit,
    });
    if (error) throw new Error(error.message);
    return data as Row[];
  };
  const homeDueCount = async () => {
    const { data } = await ayse.client.rpc("deck_summaries", { p_include_archived: false });
    const row = (data as { id: string; due_count: number }[]).find((d) => d.id === deckId);
    return Number(row?.due_count ?? -1);
  };

  beforeAll(async () => {
    assertNotProd();
    await deleteLeftoverTestUsers();
    ayse = await createTestUser("akis", "Ayşe");
    baris = await createTestUser("akis-baska", "Barış");
    await ayse.client.from("profiles").update({ daily_new_limit: 2 }).eq("id", ayse.id);
    deckId = (await ayse.client.rpc("create_deck", { p_name: "Akış testi" })).data as string;
    // Sırayla eklenir: yeni kartlar eklenme sırasına göre gelir.
    for (const front of ["alpha", "bravo", "charlie", "delta"]) {
      const { data, error } = await withRetry(() =>
        ayse.client
          .from("cards")
          .insert({ deck_id: deckId, front, back: `${front} anlamı` })
          .select("id")
          .single(),
      );
      if (error) throw new Error(error.message);
      ids[front] = data.id as string;
    }
    const barisDeck = (await baris.client.rpc("create_deck", { p_name: "Başkasının destesi" }))
      .data as string;
    const { data } = await baris.client
      .from("cards")
      .insert({ deck_id: barisDeck, front: "gizli", back: "secret" })
      .select("id")
      .single();
    barisCardId = data!.id as string;
  });

  afterAll(async () => {
    await deleteTestUsers([ayse, baris]);
  });

  it("günlük yeni sınırı (2) dolunca ek kartlar sınırın ötesindeki yeni kelimeleri verir", async () => {
    const q = await queue();
    expect(q.map((r) => r.card_id)).toEqual([ids.alpha, ids.bravo]);
    const more = await extra(q.map((r) => r.card_id));
    expect(more.map((r) => r.card_id)).toEqual([ids.charlie, ids.delta]);
    expect(more.every((r) => r.is_new)).toBe(true);
    expect(
      (
        await extra(
          q.map((r) => r.card_id),
          1,
        )
      ).map((r) => r.card_id),
    ).toEqual([ids.charlie]);
  });

  it("20 dakika içinde dönecek öğrenme kartı ana sayfada da 'hazır' sayılır (Start kaybolmaz)", async () => {
    // "Again": öğrenme adımı, birkaç dakika sonra döner.
    await answer(ayse, ids.alpha!, 1, new Date(Date.now() + 10 * 60_000));
    const q = await queue();
    expect(q.some((r) => r.card_id === ids.alpha && !r.is_new)).toBe(true);
    expect(await homeDueCount()).toBe(1);
    expect(await homeDueCount()).toBe(q.filter((r) => !r.is_new).length);
  });

  it("vadesi günler sonra olan kart hazır sayılmaz; ek kart olarak erken tekrar edilebilir", async () => {
    await answer(ayse, ids.bravo!, 4); // "Easy": doğrudan tekrar aşamasına, günler sonraya
    expect(await homeDueCount()).toBe(1); // yalnızca öğrenmedeki alpha
    expect((await queue()).some((r) => r.card_id === ids.bravo)).toBe(false);

    // Yeni kelimeler oturumda görülmüş sayılınca sıra erken tekrara gelir; öğrenmedeki kart gelmez.
    const ahead = await extra([ids.charlie!, ids.delta!]);
    expect(ahead.map((r) => r.card_id)).toEqual([ids.bravo]);
    expect(ahead[0]!.is_new).toBe(false);
  });

  it("ek kartlar başkasının destesinden asla gelmez; girişsiz istek çağıramaz", async () => {
    const { data } = await ayse.client.rpc("get_extra_cards", {
      p_deck_id: null,
      p_exclude: [],
      p_limit: 50,
    });
    expect((data as Row[]).some((r) => r.card_id === barisCardId)).toBe(false);

    const anon = await anonClient().rpc("get_extra_cards", { p_exclude: [], p_limit: 5 });
    expect(anon.error).not.toBeNull();
  });
});
