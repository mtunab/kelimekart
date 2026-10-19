import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { studyDay } from "@/lib/dates";
import {
  fromFsrsCard,
  Rating,
  review,
  toFsrsCard,
  type Grade,
  type ProgressFields,
} from "@/lib/srs";
import {
  assertNotProd,
  createTestUser,
  deleteLeftoverTestUsers,
  deleteTestUsers,
  hasDevEnv,
  type TestUser,
  withRetry,
} from "./helpers";

async function answer(
  user: TestUser,
  cardId: string,
  grade: Grade,
  override: Partial<ProgressFields> = {},
): Promise<number> {
  const { data: row } = await withRetry(() =>
    user.client.from("card_progress").select("*").eq("card_id", cardId).maybeSingle(),
  );
  const now = new Date();
  const next = { ...fromFsrsCard(review(toFsrsCard(row, now), grade, now)), ...override };
  const eventId = crypto.randomUUID();
  const { data, error } = await withRetry(() =>
    user.client.rpc("apply_review", {
      p_card_id: cardId,
      p_client_event_id: eventId,
      p_rating: grade,
      p_reviewed_at: now.toISOString(),
      p_expected_version: row?.version ?? 0,
      p_next: next,
    }),
  );
  if (error) throw new Error(error.message);
  return (data as { log_id: number }).log_id;
}

describe.skipIf(!hasDevEnv)("istatistikler elle hesaplanan değerlerle eşleşir", () => {
  let ayse: TestUser;
  let baris: TestUser;
  let deckId: string;

  beforeAll(async () => {
    assertNotProd();
    await deleteLeftoverTestUsers();
    ayse = await createTestUser("istat-a", "Ayşe İstatistik");
    baris = await createTestUser("istat-b", "Barış İstatistik");
    deckId = (await ayse.client.rpc("create_deck", { p_name: "İstatistik destesi" }))
      .data as string;
    const cards = await ayse.client
      .from("cards")
      .insert(["c1", "c2", "c3", "c4"].map((front) => ({ deck_id: deckId, front, back: front })))
      .select("id, front");
    const id = (front: string) => cards.data!.find((c) => c.front === front)!.id as string;

    // Elle kurulan senaryo:
    // c1 İyi (öğreniliyor), c2 Tekrar (öğreniliyor), c3 Kolay + aralık 30 gün (olgun),
    // c4 Zor ama GERİ ALINDI → hiçbir sayıma girmez, kart yeni kalır.
    await answer(ayse, id("c1"), Rating.Good);
    await answer(ayse, id("c2"), Rating.Again);
    await answer(ayse, id("c3"), Rating.Easy, {
      state: 2,
      scheduled_days: 30,
      due: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });
    const undone = await answer(ayse, id("c4"), Rating.Hard);
    const undo = await ayse.client.rpc("undo_review", { p_log_id: undone });
    expect(undo.data).toMatchObject({ status: "undone" });
  });

  afterAll(async () => {
    await deleteTestUsers([ayse, baris]);
  });

  it("kişisel özet: bugün 3 tekrar, 2 doğru, seri 1", async () => {
    const { data } = await ayse.client.rpc("my_stats").single();
    expect(data).toEqual({
      reviews_today: 3,
      correct_today: 2,
      reviews_week: 3,
      correct_week: 2,
      streak: 1,
      today: studyDay(new Date(), "Europe/Istanbul"),
    });
  });

  it("son 7 gün: sadece bugün 3 tekrar (2 doğru)", async () => {
    const { data } = await ayse.client.rpc("daily_reviews", { p_days: 7 });
    const rows = data as { day: string; reviews: number; correct: number }[];
    expect(rows).toHaveLength(7);
    expect(rows.at(-1)).toEqual({
      day: studyDay(new Date(), "Europe/Istanbul"),
      reviews: 3,
      correct: 2,
    });
    expect(rows.slice(0, 6).every((r) => Number(r.reviews) === 0)).toBe(true);
  });

  it("deste durumları: 1 yeni, 2 öğreniliyor, 1 olgun", async () => {
    const { data } = await ayse.client.rpc("deck_state_counts");
    const row = (data as { deck_id: string }[]).find((d) => d.deck_id === deckId);
    expect(row).toEqual({
      deck_id: deckId,
      name: "İstatistik destesi",
      new_count: 1,
      learning_count: 2,
      mature_count: 1,
    });
  });

  it("grup panosu: herkes adı, bugünkü sayıyı ve seriyi görür — başka bir şey değil", async () => {
    const { data } = await baris.client.rpc("group_board");
    const rows = data as Record<string, unknown>[];
    const a = rows.find((r) => r.display_name === "Ayşe İstatistik");
    const b = rows.find((r) => r.display_name === "Barış İstatistik");
    expect(a).toEqual({
      display_name: "Ayşe İstatistik",
      reviews_today: 3,
      streak: 1,
      is_me: false,
    });
    expect(b).toEqual({
      display_name: "Barış İstatistik",
      reviews_today: 0,
      streak: 0,
      is_me: true,
    });
    for (const r of rows)
      expect(Object.keys(r).sort()).toEqual(["display_name", "is_me", "reviews_today", "streak"]);
  });

  it("başkasının kişisel istatistiği görünmez: B'nin özeti kendi sıfırları", async () => {
    const { data } = await baris.client.rpc("my_stats").single();
    expect(data).toMatchObject({ reviews_today: 0, reviews_week: 0, streak: 0 });
    const decks = await baris.client.rpc("deck_state_counts");
    expect((decks.data as { deck_id: string }[]).map((d) => d.deck_id)).not.toContain(deckId);
    const forecast = await baris.client.rpc("due_forecast", { p_days: 60 });
    expect((forecast.data as { due_count: number }[]).every((r) => Number(r.due_count) === 0)).toBe(
      true,
    );
  });

  it("vade tahmini: olgun kart ~30 gün sonra görünür", async () => {
    const { data } = await ayse.client.rpc("due_forecast", { p_days: 40 });
    const rows = data as { day: string; due_count: number }[];
    const total = rows.reduce((sum, r) => sum + Number(r.due_count), 0);
    expect(total).toBe(3); // c1, c2 (dakikalar içinde → bugün), c3 (30 gün sonra)
    expect(Number(rows[0]!.due_count)).toBe(2);
    expect(rows.slice(28, 33).reduce((sum, r) => sum + Number(r.due_count), 0)).toBe(1);
  });
});
