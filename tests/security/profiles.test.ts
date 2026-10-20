import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  assertNotProd,
  createTestUser,
  deleteLeftoverTestUsers,
  deleteTestUsers,
  hasDevEnv,
  serviceClient,
  type TestUser,
} from "./helpers";

describe.skipIf(!hasDevEnv)("profiller (RLS)", () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    assertNotProd();
    await deleteLeftoverTestUsers();
    a = await createTestUser("a", "Ayşe");
    b = await createTestUser("b", "Barış");
  });

  afterAll(async () => {
    await deleteTestUsers([a, b]);
  });

  it("kullanıcı oluşunca profil otomatik açılır, varsayılanlar doğru", async () => {
    const { data, error } = await a.client.from("profiles").select("*").eq("id", a.id).single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      display_name: "Ayşe",
      timezone: "Europe/Istanbul",
      daily_new_limit: 10,
      daily_goal_reviews: 30,
      streak_count: 0,
      streak_last_day: null,
    });
  });

  it("kullanıcı adı yönetici komutundan gelir, tekildir ve kullanıcı değiştiremez", async () => {
    const { data } = await a.client.from("profiles").select("username").eq("id", a.id).single();
    expect(data?.username).toBe(a.username);

    const change = await a.client.from("profiles").update({ username: "baskasi" }).eq("id", a.id);
    expect(change.error).not.toBeNull();

    const dup = await serviceClient()
      .from("profiles")
      .update({ username: b.username })
      .eq("id", a.id);
    expect(dup.error?.code).toBe("23505");

    const bad = await serviceClient()
      .from("profiles")
      .update({ username: "Kötü Ad" })
      .eq("id", a.id);
    expect(bad.error).not.toBeNull();
  });

  it("A, B'nin profilini okuyamaz", async () => {
    const { data } = await a.client.from("profiles").select("id").eq("id", b.id);
    expect(data).toEqual([]);
    const all = await a.client.from("profiles").select("id");
    expect(all.data?.map((row) => row.id)).toEqual([a.id]);
  });

  it("A, B'nin profilini değiştiremez", async () => {
    await a.client.from("profiles").update({ display_name: "Ele geçirildi" }).eq("id", b.id);
    const { data } = await serviceClient()
      .from("profiles")
      .select("display_name")
      .eq("id", b.id)
      .single();
    expect(data?.display_name).toBe("Barış");
  });

  it("kendi ayarlarını değiştirebilir", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ display_name: "Ayşe K.", daily_new_limit: 15, timezone: "Europe/Berlin" })
      .eq("id", a.id);
    expect(error).toBeNull();
    const { data } = await a.client.from("profiles").select("*").eq("id", a.id).single();
    expect(data).toMatchObject({
      display_name: "Ayşe K.",
      daily_new_limit: 15,
      timezone: "Europe/Berlin",
    });
  });

  it("seri (streak) sayısını elle değiştiremez", async () => {
    const { error } = await a.client.from("profiles").update({ streak_count: 999 }).eq("id", a.id);
    expect(error).not.toBeNull();
    const { data } = await serviceClient()
      .from("profiles")
      .select("streak_count")
      .eq("id", a.id)
      .single();
    expect(data?.streak_count).toBe(0);
  });

  it("geçersiz saat dilimi reddedilir", async () => {
    const { error } = await a.client
      .from("profiles")
      .update({ timezone: "Mars/Olympus" })
      .eq("id", a.id);
    expect(error).not.toBeNull();
  });

  it("profil ekleyemez, silemez", async () => {
    const insert = await a.client
      .from("profiles")
      .insert({ id: crypto.randomUUID(), display_name: "Sahte" });
    expect(insert.error).not.toBeNull();
    await a.client.from("profiles").delete().eq("id", a.id);
    const { data } = await serviceClient().from("profiles").select("id").eq("id", a.id);
    expect(data).toHaveLength(1);
  });

  it("giriş yapmamış istek profil göremez", async () => {
    const { data, error } = await anonClient().from("profiles").select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
