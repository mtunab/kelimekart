import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { review, type Grade, type ProgressFields } from "@/lib/srs";
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

/** Sunucunun yaptığı gibi: mevcut durumu oku, yeni durumu hesapla, apply_review ile yaz. */
async function answer(
  user: TestUser,
  cardId: string,
  grade: Grade,
  override: Partial<ProgressFields> = {},
) {
  const { data: row } = await withRetry(() =>
    user.client.from("card_progress").select("*").eq("card_id", cardId).maybeSingle(),
  );
  const now = new Date();
  const next = { ...review(row, grade, now), ...override };
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

  it("90 sn sonra dönecek bilinmeyen kart ana sayfada da 'hazır' sayılır (Start kaybolmaz)", async () => {
    // "Bilmedim": kart 90 sn sonra döner ve en alt basamakta kalır.
    await answer(ayse, ids.alpha!, 1);
    const { data: row } = await ayse.client
      .from("card_progress")
      .select("learning_steps, state, due")
      .eq("card_id", ids.alpha!)
      .single();
    expect(row).toMatchObject({ learning_steps: 0, state: 1 });
    const waitMs = Date.parse(row!.due as string) - Date.now();
    expect(waitMs).toBeGreaterThan(60_000);
    expect(waitMs).toBeLessThanOrEqual(90_000);

    const q = await queue();
    expect(q.some((r) => r.card_id === ids.alpha && !r.is_new)).toBe(true);
    expect(await homeDueCount()).toBe(1);
    expect(await homeDueCount()).toBe(q.filter((r) => !r.is_new).length);
  });

  it("vadesi günler sonra olan kart hazır sayılmaz; ek kart olarak erken tekrar edilebilir", async () => {
    // bravo 4. basamakta: 2 gün sonra dönecek.
    await answer(ayse, ids.bravo!, 3, {
      state: 2,
      learning_steps: 4,
      scheduled_days: 2,
      due: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    });
    expect(await homeDueCount()).toBe(1); // yalnızca 90 sn'lik alpha
    expect((await queue()).some((r) => r.card_id === ids.bravo)).toBe(false);

    // Yeni kelimeler oturumda görülmüş sayılınca sıra erken tekrara gelir; öğrenmedeki kart gelmez.
    const ahead = await extra([ids.charlie!, ids.delta!]);
    expect(ahead.map((r) => r.card_id)).toEqual([ids.bravo]);
    expect(ahead[0]!.is_new).toBe(false);
  });

  it("erken tekrar edilen kart bilinse de basamak atlamaz, zamanı değişmez; bilinmezse iner", async () => {
    const read = async () =>
      (
        await ayse.client
          .from("card_progress")
          .select("learning_steps, state, due")
          .eq("card_id", ids.bravo!)
          .single()
      ).data!;
    const before = await read();
    await answer(ayse, ids.bravo!, 3);
    expect(await read()).toEqual(before);

    await answer(ayse, ids.bravo!, 1);
    const failed = await read();
    expect(failed).toMatchObject({ learning_steps: 2, state: 1 });
    expect(Date.parse(failed.due as string) - Date.now()).toBeLessThanOrEqual(90_000);
  });

  it("30 dk bekleyen kart hazır sayılmaz: ne kuyruğa girer ne ana sayfada görünür", async () => {
    const dueBefore = await homeDueCount();
    await answer(ayse, ids.charlie!, 4); // yeni kart, "çok kolay": 2. basamak, 30 dk
    expect((await queue()).some((r) => r.card_id === ids.charlie)).toBe(false);
    expect(await homeDueCount()).toBe(dueBefore);
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
