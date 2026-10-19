import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, studyDay } from "@/lib/dates";
import { fromFsrsCard, Rating, review, toFsrsCard, type Grade } from "@/lib/srs";
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
  overrideDue?: Date,
): Promise<number> {
  const { data: row } = await withRetry(() =>
    user.client.from("card_progress").select("*").eq("card_id", cardId).maybeSingle(),
  );
  const now = new Date();
  const next = fromFsrsCard(review(toFsrsCard(row, now), grade, now));
  if (overrideDue) next.due = overrideDue.toISOString();
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

type QueueRow = { card_id: string; is_new: boolean; deck_id: string };

describe.skipIf(!hasDevEnv)("içe aktarma, arama, kuyruk ve günlük sayılar", () => {
  let ayse: TestUser;
  let baris: TestUser;
  let deckId: string;

  const cardIdByFront = async (front: string) => {
    const { data } = await ayse.client
      .from("cards")
      .select("id")
      .eq("deck_id", deckId)
      .eq("front", front)
      .single();
    return data!.id as string;
  };

  beforeAll(async () => {
    assertNotProd();
    await deleteLeftoverTestUsers();
    ayse = await createTestUser("calisan", "Ayşe");
    baris = await createTestUser("baska", "Barış");
    // Testte yeni kart limitini küçük tut.
    await ayse.client.from("profiles").update({ daily_new_limit: 3 }).eq("id", ayse.id);
    const deck = await ayse.client.rpc("create_deck", { p_name: "Kuyruk testi" });
    deckId = deck.data as string;
  });

  afterAll(async () => {
    await deleteTestUsers([ayse, baris]);
  });

  describe("toplu içe aktarma", () => {
    const rows = (fronts: string[]) =>
      fronts.map((front) => ({
        front,
        back: `${front} anlamı`,
        example: null,
        note: null,
        tags: [],
      }));

    it("ekler ve var olanları atlar (ezmez)", async () => {
      const first = await ayse.client.rpc("import_cards", {
        p_deck_id: deckId,
        p_cards: rows(["one", "two", "three", "four", "five"]),
      });
      expect(first.data).toEqual({ inserted: 5, skipped: 0 });

      await ayse.client
        .from("cards")
        .update({ back: "BİR" })
        .eq("deck_id", deckId)
        .eq("front", "one");
      const second = await ayse.client.rpc("import_cards", {
        p_deck_id: deckId,
        p_cards: rows(["ONE", "six"]),
      });
      expect(second.data).toEqual({ inserted: 1, skipped: 1 });
      const { data } = await ayse.client
        .from("cards")
        .select("back")
        .eq("deck_id", deckId)
        .eq("front", "one")
        .single();
      expect(data?.back).toBe("BİR");
    });

    it("tek işlemdir: bir satır bozuksa hiçbiri eklenmez", async () => {
      const before = await ayse.client
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("deck_id", deckId);
      const bad = await ayse.client.rpc("import_cards", {
        p_deck_id: deckId,
        p_cards: [...rows(["seven", "eight"]), { front: "x".repeat(201), back: "uzun", tags: [] }],
      });
      expect(bad.error).not.toBeNull();
      const after = await ayse.client
        .from("cards")
        .select("id", { count: "exact", head: true })
        .eq("deck_id", deckId);
      expect(after.count).toBe(before.count);
    });

    it("üye olmayan desteye içe aktaramaz", async () => {
      const result = await baris.client.rpc("import_cards", {
        p_deck_id: deckId,
        p_cards: rows(["hack"]),
      });
      expect(result.error).not.toBeNull();
    });
  });

  describe("arama", () => {
    it("ön, arka ve etikette büyük/küçük harf duyarsız arar; toplam sayıyı verir", async () => {
      await ayse.client
        .from("cards")
        .update({ tags: ["sayı"] })
        .eq("deck_id", deckId)
        .eq("front", "two");
      const byFront = await ayse.client.rpc("search_cards", { p_deck_id: deckId, p_query: "THR" });
      expect(byFront.data?.map((r: { front: string }) => r.front)).toEqual(["three"]);
      const byBack = await ayse.client.rpc("search_cards", { p_deck_id: deckId, p_query: "bir" });
      expect(byBack.data?.map((r: { front: string }) => r.front)).toEqual(["one"]);
      const byTag = await ayse.client.rpc("search_cards", { p_deck_id: deckId, p_tag: "Sayı" });
      expect(byTag.data?.map((r: { front: string }) => r.front)).toEqual(["two"]);
    });

    it("sayfalar ve toplamı doğru verir", async () => {
      const page1 = await ayse.client.rpc("search_cards", {
        p_deck_id: deckId,
        p_limit: 4,
        p_offset: 0,
      });
      const page2 = await ayse.client.rpc("search_cards", {
        p_deck_id: deckId,
        p_limit: 4,
        p_offset: 4,
      });
      expect(page1.data).toHaveLength(4);
      expect(page2.data).toHaveLength(2);
      expect(Number(page1.data[0].total_count)).toBe(6);
    });

    it("üye olmayan hiçbir kart bulamaz", async () => {
      const result = await baris.client.rpc("search_cards", { p_deck_id: deckId });
      expect(result.data).toEqual([]);
    });
  });

  describe("çalışma kuyruğu", () => {
    it("yeni kart sayısı günlük limiti aşmaz", async () => {
      const { data } = await ayse.client.rpc("get_study_queue", { p_deck_id: deckId });
      const rowsQ = data as QueueRow[];
      expect(rowsQ.filter((r) => r.is_new)).toHaveLength(3);
      expect(rowsQ.every((r) => r.deck_id === deckId)).toBe(true);
    });

    it("bugün açılan yeni kartlar limitten düşer; vadesi gelen kart kuyruğa girer", async () => {
      const one = await cardIdByFront("one");
      const two = await cardIdByFront("two");
      await answer(ayse, one, Rating.Easy, new Date(Date.now() - 60_000)); // hemen vadesi gelsin
      await answer(ayse, two, Rating.Easy); // günler sonra

      const { data } = await ayse.client.rpc("get_study_queue", { p_deck_id: deckId });
      const rowsQ = data as QueueRow[];
      expect(rowsQ.filter((r) => r.is_new)).toHaveLength(1);
      const due = rowsQ.filter((r) => !r.is_new).map((r) => r.card_id);
      expect(due).toEqual([one]);
    });

    it("geri alınan cevap yeni kart sayımından düşer", async () => {
      const three = await cardIdByFront("three");
      const logId = await answer(ayse, three, Rating.Good);
      let q = (await ayse.client.rpc("get_study_queue", { p_deck_id: deckId })).data as QueueRow[];
      expect(q.filter((r) => r.is_new)).toHaveLength(0);

      await ayse.client.rpc("undo_review", { p_log_id: logId });
      q = (await ayse.client.rpc("get_study_queue", { p_deck_id: deckId })).data as QueueRow[];
      expect(q.filter((r) => r.is_new)).toHaveLength(1);
    });

    it("arşivlenen kart kuyruğa girmez", async () => {
      const one = await cardIdByFront("one");
      await ayse.client.from("cards").update({ archived: true }).eq("id", one);
      const q = (await ayse.client.rpc("get_study_queue", { p_deck_id: deckId }))
        .data as QueueRow[];
      expect(q.map((r) => r.card_id)).not.toContain(one);
      await ayse.client.from("cards").update({ archived: false }).eq("id", one);
    });

    it("üye olmayanın kuyruğunda bu destenin kartı yok", async () => {
      const q = (await baris.client.rpc("get_study_queue", { p_deck_id: deckId }))
        .data as QueueRow[];
      expect(q).toEqual([]);
    });
  });

  describe("günlük sayılar", () => {
    it("bugünün tekrar, doğru ve yeni sayısı; geri alınan sayılmaz", async () => {
      const { data } = await ayse.client.rpc("study_today").single();
      expect(data).toMatchObject({
        reviews_today: 2, // one + two (three geri alındı)
        correct_today: 2,
        new_today: 2,
        daily_goal: 30,
        daily_new_limit: 3,
        streak_count: 1,
        today: studyDay(new Date(), "Europe/Istanbul"),
      });
    });

    it("deste özeti kişiye özel sayıları verir", async () => {
      const mine = (await ayse.client.rpc("deck_summaries")).data as {
        id: string;
        card_count: number;
        new_count: number;
        due_count: number;
      }[];
      const deck = mine.find((d) => d.id === deckId)!;
      expect(Number(deck.card_count)).toBe(6);
      expect(Number(deck.new_count)).toBe(4);
      expect(Number(deck.due_count)).toBe(1);
      const theirs = (await baris.client.rpc("deck_summaries")).data as { id: string }[];
      expect(theirs.map((d) => d.id)).not.toContain(deckId);
    });

    it("vade tahmini: bugün ve ileriki günler", async () => {
      const four = await cardIdByFront("four");
      const tomorrowNoon = new Date(Date.now() + 86_400_000);
      await answer(ayse, four, Rating.Easy, tomorrowNoon);
      const { data } = await ayse.client.rpc("due_forecast", { p_days: 14 });
      const rowsF = data as { day: string; due_count: number }[];
      expect(rowsF).toHaveLength(14);
      const today = studyDay(new Date(), "Europe/Istanbul");
      expect(rowsF[0]!.day).toBe(today);
      const byDay = Object.fromEntries(rowsF.map((r) => [r.day, Number(r.due_count)]));
      expect(byDay[today]).toBeGreaterThanOrEqual(1); // "one" (gecikmiş)
      expect(byDay[studyDay(tomorrowNoon, "Europe/Istanbul")]).toBeGreaterThanOrEqual(1);
      expect(rowsF.reduce((sum, r) => sum + Number(r.due_count), 0)).toBeGreaterThanOrEqual(2);
      expect(addDays(today, 13)).toBe(rowsF[13]!.day);
    });
  });

  describe("1000 kartlık deste", () => {
    it("liste, arama ve kuyruk hızlı yanıt verir", async () => {
      const big = await ayse.client.rpc("create_deck", { p_name: "Büyük deste" });
      const bigId = big.data as string;
      const rows1000 = Array.from({ length: 1000 }, (_, i) => ({
        front: `word-${String(i).padStart(4, "0")}`,
        back: `kelime ${i}`,
        example: null,
        note: null,
        tags: i % 10 === 0 ? ["onluk"] : [],
      }));
      const imported = await ayse.client.rpc("import_cards", {
        p_deck_id: bigId,
        p_cards: rows1000,
      });
      expect(imported.data).toEqual({ inserted: 1000, skipped: 0 });

      const time = async (fn: () => PromiseLike<unknown>) => {
        const start = performance.now();
        await fn();
        return performance.now() - start;
      };
      // Ağ gecikmesi dahil ölçülür; sunucu tarafı süre bundan çok daha kısadır.
      const listMs = await time(() =>
        ayse.client.rpc("search_cards", { p_deck_id: bigId, p_offset: 950 }),
      );
      const searchMs = await time(() =>
        ayse.client.rpc("search_cards", { p_deck_id: bigId, p_query: "-09" }),
      );
      const tagMs = await time(() =>
        ayse.client.rpc("search_cards", { p_deck_id: bigId, p_tag: "onluk" }),
      );
      const queueMs = await time(() => ayse.client.rpc("get_study_queue", { p_deck_id: bigId }));
      for (const ms of [listMs, searchMs, tagMs, queueMs]) expect(ms).toBeLessThan(3000);

      const search = await ayse.client.rpc("search_cards", {
        p_deck_id: bigId,
        p_query: "word-099",
      });
      expect(search.data?.map((r: { front: string }) => r.front).sort()).toEqual(
        Array.from({ length: 10 }, (_, i) => `word-099${i}`),
      );
    });
  });
});
