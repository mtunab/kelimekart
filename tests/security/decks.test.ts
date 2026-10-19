import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { studyDay } from "@/lib/dates";
import { fromFsrsCard, Rating, review, toFsrsCard, type Grade } from "@/lib/srs";
import {
  anonClient,
  assertNotProd,
  createTestUser,
  deleteLeftoverTestUsers,
  deleteTestUsers,
  hasDevEnv,
  serviceClient,
  type TestUser,
  withRetry,
} from "./helpers";

async function applyReview(
  user: TestUser,
  cardId: string,
  grade: Grade,
  opts: { eventId?: string; expectedVersion?: number } = {},
) {
  const { data: row } = await withRetry(() =>
    user.client.from("card_progress").select("*").eq("card_id", cardId).maybeSingle(),
  );
  const now = new Date();
  const next = review(toFsrsCard(row, now), grade, now);
  return user.client.rpc("apply_review", {
    p_card_id: cardId,
    p_client_event_id: opts.eventId ?? crypto.randomUUID(),
    p_rating: grade,
    p_reviewed_at: now.toISOString(),
    p_expected_version: opts.expectedVersion ?? row?.version ?? 0,
    p_next: fromFsrsCard(next),
  });
}

describe.skipIf(!hasDevEnv)("desteler, kartlar ve kişiye özel ilerleme (RLS)", () => {
  let owner: TestUser; // deste sahibi
  let member: TestUser; // sonradan üye yapılan
  let outsider: TestUser; // hiç üye olmayan
  let deckId: string;
  let cardId: string;

  beforeAll(async () => {
    assertNotProd();
    await deleteLeftoverTestUsers();
    owner = await createTestUser("sahip", "Ayşe");
    member = await createTestUser("uye", "Barış");
    outsider = await createTestUser("disari", "Cem");

    const deck = await owner.client.rpc("create_deck", {
      p_name: "Test destesi",
      p_source_lang: "en",
      p_target_lang: "tr",
    });
    expect(deck.error).toBeNull();
    deckId = deck.data as string;

    const card = await owner.client
      .from("cards")
      .insert({ deck_id: deckId, front: "apple", back: "elma", tags: ["meyve"] })
      .select("id")
      .single();
    expect(card.error).toBeNull();
    cardId = card.data!.id;
  });

  afterAll(async () => {
    await deleteTestUsers([owner, member, outsider]);
  });

  describe("deste ve üyelik", () => {
    it("desteyi oluşturan sahibi olur", async () => {
      const { data } = await owner.client
        .from("deck_members")
        .select("user_id, role")
        .eq("deck_id", deckId);
      expect(data).toEqual([{ user_id: owner.id, role: "owner" }]);
    });

    it("üye olmayan desteyi ve kartlarını göremez", async () => {
      expect((await outsider.client.from("decks").select("id").eq("id", deckId)).data).toEqual([]);
      expect((await outsider.client.from("cards").select("id").eq("deck_id", deckId)).data).toEqual(
        [],
      );
      expect(
        (await outsider.client.from("deck_members").select("user_id").eq("deck_id", deckId)).data,
      ).toEqual([]);
    });

    it("üye olmayan desteye kart ekleyemez, kartı düzenleyemez", async () => {
      const insert = await outsider.client
        .from("cards")
        .insert({ deck_id: deckId, front: "hack", back: "x" });
      expect(insert.error).not.toBeNull();

      await outsider.client.from("cards").update({ back: "bozuldu" }).eq("id", cardId);
      const { data } = await serviceClient().from("cards").select("back").eq("id", cardId).single();
      expect(data?.back).toBe("elma");
    });

    it("üye olmayan kendini desteye ekleyemez", async () => {
      const asMember = await outsider.client
        .from("deck_members")
        .insert({ deck_id: deckId, user_id: outsider.id, role: "member" });
      expect(asMember.error).not.toBeNull();
      const asOwner = await outsider.client
        .from("deck_members")
        .insert({ deck_id: deckId, user_id: outsider.id, role: "owner" });
      expect(asOwner.error).not.toBeNull();
    });

    it("sahip üye ekler; üye desteyi görür ve kart ekler", async () => {
      const add = await owner.client
        .from("deck_members")
        .insert({ deck_id: deckId, user_id: member.id, role: "member" });
      expect(add.error).toBeNull();

      expect((await member.client.from("decks").select("name").eq("id", deckId)).data).toEqual([
        { name: "Test destesi" },
      ]);
      const card = await member.client
        .from("cards")
        .insert({ deck_id: deckId, front: "pear", back: "armut" });
      expect(card.error).toBeNull();
    });

    it("üye başkasını ekleyemez, sahibi çıkaramaz, desteyi yeniden adlandıramaz", async () => {
      const addOther = await member.client
        .from("deck_members")
        .insert({ deck_id: deckId, user_id: outsider.id, role: "member" });
      expect(addOther.error).not.toBeNull();

      await member.client
        .from("deck_members")
        .delete()
        .eq("deck_id", deckId)
        .eq("user_id", owner.id);
      await member.client.from("decks").update({ name: "Ele geçirildi" }).eq("id", deckId);

      const admin = serviceClient();
      const owners = await admin
        .from("deck_members")
        .select("user_id")
        .eq("deck_id", deckId)
        .eq("role", "owner");
      expect(owners.data).toEqual([{ user_id: owner.id }]);
      const deck = await admin.from("decks").select("name").eq("id", deckId).single();
      expect(deck.data?.name).toBe("Test destesi");
    });

    it("sahip desteyi yeniden adlandırabilir ve arşivleyebilir", async () => {
      const rename = await owner.client
        .from("decks")
        .update({ name: "Meyveler" })
        .eq("id", deckId)
        .select("name")
        .single();
      expect(rename.data?.name).toBe("Meyveler");
    });

    it("sahip kendini sahiplikten çıkaramaz", async () => {
      await owner.client
        .from("deck_members")
        .delete()
        .eq("deck_id", deckId)
        .eq("user_id", owner.id);
      const { data } = await serviceClient()
        .from("deck_members")
        .select("role")
        .eq("deck_id", deckId)
        .eq("user_id", owner.id);
      expect(data).toEqual([{ role: "owner" }]);
    });
  });

  describe("kartlar", () => {
    it("aynı kelime (büyük/küçük harf farkıyla) iki kez eklenemez", async () => {
      const dup = await owner.client
        .from("cards")
        .insert({ deck_id: deckId, front: "  APPLE ", back: "elma 2" });
      expect(dup.error?.code).toBe("23505");
    });

    it("oluşturan kişi taklit edilemez, kart başka desteye taşınamaz", async () => {
      const spoof = await owner.client
        .from("cards")
        .insert({ deck_id: deckId, front: "grape", back: "üzüm", created_by: member.id });
      expect(spoof.error).not.toBeNull();

      const other = await owner.client.rpc("create_deck", { p_name: "Diğer" });
      const move = await owner.client
        .from("cards")
        .update({ deck_id: other.data as string })
        .eq("id", cardId);
      expect(move.error).not.toBeNull();
    });

    it("kart silinemez (arşivlenir)", async () => {
      await owner.client.from("cards").delete().eq("id", cardId);
      const { data } = await serviceClient().from("cards").select("id").eq("id", cardId);
      expect(data).toHaveLength(1);
    });

    it("geçersiz etiketler reddedilir", async () => {
      const bad = await owner.client
        .from("cards")
        .insert({ deck_id: deckId, front: "kiwi", back: "kivi", tags: ["a", "A"] });
      expect(bad.error).not.toBeNull();
    });
  });

  describe("kişiye özel ilerleme", () => {
    it("ilerleme ve kayıt tablolarına doğrudan yazılamaz", async () => {
      const progress = await owner.client.from("card_progress").insert({
        user_id: owner.id,
        card_id: cardId,
        due: new Date().toISOString(),
        stability: 1,
        difficulty: 1,
        state: 2,
      });
      expect(progress.error).not.toBeNull();
      const log = await owner.client.from("review_logs").insert({
        user_id: owner.id,
        card_id: cardId,
        rating: 3,
        reviewed_at: new Date().toISOString(),
        state_before: 0,
        version_after: 1,
        client_event_id: crypto.randomUUID(),
      });
      expect(log.error).not.toBeNull();
    });

    it("cevap işlenir: ilerleme satırı (tembel) oluşur, kayıt eklenir, seri başlar", async () => {
      const before = await owner.client.from("card_progress").select("card_id");
      expect(before.data).toEqual([]);

      const result = await applyReview(owner, cardId, Rating.Good);
      expect(result.error).toBeNull();
      expect(result.data).toMatchObject({ status: "applied", version: 1 });

      const progress = await owner.client.from("card_progress").select("*").eq("card_id", cardId);
      expect(progress.data).toHaveLength(1);
      expect(progress.data![0]).toMatchObject({ reps: 1, version: 1 });

      const profile = await owner.client
        .from("profiles")
        .select("streak_count, streak_last_day")
        .eq("id", owner.id)
        .single();
      expect(profile.data).toEqual({
        streak_count: 1,
        streak_last_day: studyDay(new Date(), "Europe/Istanbul"),
      });
    });

    it("A, B'nin ilerlemesini ve kayıtlarını okuyamaz", async () => {
      await applyReview(member, cardId, Rating.Hard);
      const progress = await owner.client
        .from("card_progress")
        .select("user_id")
        .eq("user_id", member.id);
      expect(progress.data).toEqual([]);
      const logs = await owner.client
        .from("review_logs")
        .select("user_id")
        .eq("user_id", member.id);
      expect(logs.data).toEqual([]);

      const own = await member.client.from("card_progress").select("user_id");
      expect(own.data?.every((row) => row.user_id === member.id)).toBe(true);
    });

    it("aynı clientEventId ikinci kez gelirse ilerleme değişmez", async () => {
      const eventId = crypto.randomUUID();
      const first = await applyReview(owner, cardId, Rating.Good, { eventId });
      expect(first.data).toMatchObject({ status: "applied" });

      const snapshot = await owner.client
        .from("card_progress")
        .select("*")
        .eq("card_id", cardId)
        .single();
      const logCount = await owner.client
        .from("review_logs")
        .select("id", { count: "exact", head: true })
        .eq("card_id", cardId);

      // Aynı olay, farklı bir puanla bile tekrar gönderilse yok sayılır.
      const second = await applyReview(owner, cardId, Rating.Easy, { eventId });
      expect(second.data).toMatchObject({ status: "duplicate" });

      const after = await owner.client
        .from("card_progress")
        .select("*")
        .eq("card_id", cardId)
        .single();
      expect(after.data).toEqual(snapshot.data);
      const logCountAfter = await owner.client
        .from("review_logs")
        .select("id", { count: "exact", head: true })
        .eq("card_id", cardId);
      expect(logCountAfter.count).toBe(logCount.count);
    });

    it("eski sürümle gelen cevap (çakışma) hiçbir şeyi değiştirmez", async () => {
      const snapshot = await owner.client
        .from("card_progress")
        .select("*")
        .eq("card_id", cardId)
        .single();
      const stale = await applyReview(owner, cardId, Rating.Again, { expectedVersion: 1 });
      expect(stale.data).toMatchObject({ status: "conflict" });
      const after = await owner.client
        .from("card_progress")
        .select("*")
        .eq("card_id", cardId)
        .single();
      expect(after.data).toEqual(snapshot.data);
    });

    it("üye olmayan karta cevap gönderemez", async () => {
      const result = await applyReview(outsider, cardId, Rating.Good);
      expect(result.error).not.toBeNull();
      const { data } = await serviceClient()
        .from("card_progress")
        .select("user_id")
        .eq("user_id", outsider.id);
      expect(data).toEqual([]);
    });

    it("geri al: ilerleme önceki haline döner, kayıt silinmez, geri alma işaretlenir", async () => {
      const before = await owner.client
        .from("card_progress")
        .select("*")
        .eq("card_id", cardId)
        .single();
      const applied = await applyReview(owner, cardId, Rating.Again);
      const logId = (applied.data as { log_id: number }).log_id;

      const undo = await owner.client.rpc("undo_review", { p_log_id: logId });
      expect(undo.data).toMatchObject({ status: "undone" });

      const after = await owner.client
        .from("card_progress")
        .select("*")
        .eq("card_id", cardId)
        .single();
      const fsrsFields = (row: Record<string, unknown>) => {
        const copy = { ...row };
        delete copy.version;
        delete copy.updated_at;
        return copy;
      };
      expect(fsrsFields(after.data!)).toEqual(fsrsFields(before.data!));
      expect(after.data!.version).toBe(before.data!.version + 2);

      const log = await owner.client.from("review_logs").select("id").eq("id", logId);
      expect(log.data).toHaveLength(1);
      const undone = await owner.client
        .from("review_log_undos")
        .select("log_id")
        .eq("log_id", logId);
      expect(undone.data).toHaveLength(1);

      const again = await owner.client.rpc("undo_review", { p_log_id: logId });
      expect(again.data).toMatchObject({ status: "duplicate" });
    });

    it("yeni kartın ilk cevabı geri alınınca kart tekrar yeni olur", async () => {
      const fresh = await owner.client
        .from("cards")
        .insert({ deck_id: deckId, front: "melon", back: "kavun" })
        .select("id")
        .single();
      const applied = await applyReview(owner, fresh.data!.id, Rating.Good);
      const logId = (applied.data as { log_id: number }).log_id;
      await owner.client.rpc("undo_review", { p_log_id: logId });
      const progress = await owner.client
        .from("card_progress")
        .select("card_id")
        .eq("card_id", fresh.data!.id);
      expect(progress.data).toEqual([]);
    });

    it("başkasının cevabını geri alamaz", async () => {
      const applied = await applyReview(member, cardId, Rating.Good);
      const logId = (applied.data as { log_id: number }).log_id;
      const undo = await owner.client.rpc("undo_review", { p_log_id: logId });
      expect(undo.error).not.toBeNull();
    });
  });

  describe("giriş yapmamış istek", () => {
    it.each([
      "decks",
      "deck_members",
      "cards",
      "card_progress",
      "review_logs",
      "review_log_undos",
      "profiles",
    ])("%s tablosunu okuyamaz", async (table) => {
      const { data, error } = await anonClient().from(table).select("*").limit(1);
      expect(error !== null || (data ?? []).length === 0).toBe(true);
    });

    it("fonksiyonları çağıramaz", async () => {
      const { error } = await anonClient().rpc("create_deck", { p_name: "x" });
      expect(error).not.toBeNull();
    });
  });

  describe("veritabanı ve uygulama aynı 'gün' kuralını kullanır", () => {
    it.each([
      ["2026-05-10T00:59:00Z", "Europe/Istanbul"],
      ["2026-05-10T01:00:00Z", "Europe/Istanbul"],
      ["2026-03-29T01:59:00Z", "Europe/Berlin"],
      ["2026-03-29T02:00:00Z", "Europe/Berlin"],
      ["2026-05-10T07:59:00Z", "America/New_York"],
      ["2026-05-10T08:00:00Z", "America/New_York"],
    ])("%s / %s", async (at, tz) => {
      const { data } = await serviceClient().rpc("local_study_day", {
        p_at: at,
        p_timezone: tz,
      });
      expect(data).toBe(studyDay(new Date(at), tz));
    });
  });
});
