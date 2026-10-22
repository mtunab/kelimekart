import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertNotProd,
  deleteLeftoverTestUsers,
  deleteTestUsers,
  hasDevEnv,
  serviceClient,
  testEmail,
} from "./helpers";

describe.skipIf(!hasDevEnv)("kişi sınırı (20)", () => {
  const created: { id: string }[] = [];

  beforeAll(async () => {
    assertNotProd();
    await deleteLeftoverTestUsers();
  });

  afterAll(async () => {
    await deleteTestUsers(created);
  });

  it("sınıra ulaşılınca bir sonraki kullanıcı oluşturulamaz ve geride yarım kayıt kalmaz", async () => {
    const admin = serviceClient();
    const { data: limit } = await admin.rpc("max_profiles");
    expect(limit).toBe(20);
    const max = limit as number;

    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    const existing = count ?? 0;
    expect(existing).toBeLessThanOrEqual(max);

    // Sınıra kadar doldur (küçük gruplar halinde paralel: yavaş ağda süre uzamasın).
    const missing = Array.from({ length: max - existing }, (_, i) => existing + i);
    for (let from = 0; from < missing.length; from += 4) {
      const batch = missing.slice(from, from + 4);
      const results = await Promise.all(
        batch.map((i) =>
          admin.auth.admin.createUser({ email: testEmail(`dolgu${i}`), email_confirm: true }),
        ),
      );
      for (const { data, error } of results) {
        expect(error).toBeNull();
        created.push({ id: data.user!.id });
      }
    }

    const extraEmail = testEmail("fazla");
    const { data, error } = await admin.auth.admin.createUser({
      email: extraEmail,
      email_confirm: true,
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();

    const after = await admin.from("profiles").select("id", { count: "exact", head: true });
    expect(after.count).toBe(max);

    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(users.data.users.some((user) => user.email === extraEmail)).toBe(false);
  }, 300_000); // art arda çok sayıda ağ isteği yapar
});
