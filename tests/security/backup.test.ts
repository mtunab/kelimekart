import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fromFsrsCard, Rating, review, toFsrsCard } from "@/lib/srs";
import { createBackup, restoreBackup, type Backup } from "../../scripts/lib/backup";
import {
  assertNotProd,
  createTestUser,
  deleteLeftoverTestUsers,
  deleteTestUsers,
  hasDevEnv,
  serviceClient,
  type TestUser,
  withRetry,
} from "./helpers";

async function answer(user: TestUser, cardId: string) {
  const { data: row } = await user.client
    .from("card_progress")
    .select("*")
    .eq("card_id", cardId)
    .maybeSingle();
  const now = new Date();
  const eventId = crypto.randomUUID();
  const { data, error } = await withRetry(() =>
    user.client.rpc("apply_review", {
      p_card_id: cardId,
      p_client_event_id: eventId,
      p_rating: Rating.Good,
      p_reviewed_at: now.toISOString(),
      p_expected_version: row?.version ?? 0,
      p_next: fromFsrsCard(review(toFsrsCard(row, now), Rating.Good, now)),
    }),
  );
  if (error) throw new Error(error.message);
  return data as { status: string; log_id: number };
}

/** Yedeği yalnızca bu testin kullanıcısına ait verilere daraltır (dev'deki diğer verilere dokunmamak için). */
function onlyUser(backup: Backup, userId: string, deckId: string): Backup {
  const t = backup.tables;
  const cardIds = new Set(t.cards.filter((c) => c.deck_id === deckId).map((c) => c.id));
  const logIds = new Set(t.review_logs.filter((l) => l.user_id === userId).map((l) => l.id));
  return {
    ...backup,
    users: backup.users.filter((u) => u.id === userId),
    tables: {
      profiles: t.profiles.filter((r) => r.id === userId),
      decks: t.decks.filter((r) => r.id === deckId),
      deck_members: t.deck_members.filter((r) => r.deck_id === deckId),
      cards: t.cards.filter((r) => cardIds.has(r.id)),
      card_progress: t.card_progress.filter((r) => r.user_id === userId),
      review_logs: t.review_logs.filter((r) => logIds.has(r.id)),
      review_log_undos: t.review_log_undos.filter((r) => logIds.has(r.log_id)),
    },
  };
}

describe.skipIf(!hasDevEnv)("yedek al → sil → geri yükle", () => {
  let user: TestUser;
  let deckId: string;
  let backup: Backup;
  const counts = async () => {
    const admin = serviceClient();
    const q = (t: string, col: string, v: string) =>
      admin.from(t).select("*", { count: "exact", head: true }).eq(col, v);
    return {
      decks: (await q("decks", "id", deckId)).count,
      cards: (await q("cards", "deck_id", deckId)).count,
      progress: (await q("card_progress", "user_id", user.id)).count,
      logs: (await q("review_logs", "user_id", user.id)).count,
      undos: (await q("review_log_undos", "user_id", user.id)).count,
    };
  };

  beforeAll(async () => {
    assertNotProd();
    await deleteLeftoverTestUsers();
    user = await createTestUser("yedek", "Yedek Testi");
    deckId = (await user.client.rpc("create_deck", { p_name: "Yedek destesi" })).data as string;
    const cards = await user.client
      .from("cards")
      .insert(
        ["kitap", "kalem", "defter"].map((front) => ({ deck_id: deckId, front, back: front })),
      )
      .select("id");
    const [c1, c2] = cards.data!.map((c) => c.id as string);
    await answer(user, c1!);
    const second = await answer(user, c2!);
    await user.client.rpc("undo_review", { p_log_id: second.log_id });
  });

  afterAll(async () => {
    await deleteTestUsers([user]);
  });

  it("yedek tüm tabloları ve kullanıcı listesini içerir", async () => {
    backup = onlyUser(await createBackup(serviceClient(), "dev"), user.id, deckId);
    expect(backup.format).toBe("kelimekart-backup");
    expect(backup.tables.cards).toHaveLength(3);
    expect(backup.tables.review_logs).toHaveLength(2);
    expect(backup.tables.review_log_undos).toHaveLength(1);
    expect(backup.users.map((u) => u.id)).toEqual([user.id]);
  });

  it("deste silinip yedekten geri yüklenince her şey geri gelir", async () => {
    const before = await counts();
    expect(before).toEqual({ decks: 1, cards: 3, progress: 1, logs: 2, undos: 1 });

    await serviceClient().from("decks").delete().eq("id", deckId);
    expect(await counts()).toEqual({ decks: 0, cards: 0, progress: 0, logs: 0, undos: 0 });

    const report = await restoreBackup(serviceClient(), backup);
    expect(report).toMatchObject({
      decks: 1,
      cards: 3,
      card_progress: 1,
      review_logs: 2,
      skippedUsers: [],
    });
    expect(await counts()).toEqual(before);

    // Kullanıcı kendi verisini yine görüyor (üyelik ve RLS çalışıyor).
    const mine = await user.client.from("cards").select("front").eq("deck_id", deckId);
    expect(mine.data?.map((c) => c.front).sort()).toEqual(["defter", "kalem", "kitap"]);
  });

  it("geri yüklemeden sonra yeni cevaplar sorunsuz kaydedilir (numara çakışması yok)", async () => {
    const { data } = await user.client
      .from("cards")
      .select("id")
      .eq("deck_id", deckId)
      .eq("front", "defter")
      .single();
    const result = await answer(user, data!.id);
    expect(result.status).toBe("applied");
    expect(result.log_id).toBeGreaterThan(
      Math.max(...backup.tables.review_logs.map((l) => Number(l.id))),
    );
  });
});
