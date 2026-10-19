import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assertNotProd,
  deleteLeftoverTestUsers,
  deleteTestUsers,
  hasDevEnv,
  serviceClient,
  testEmail,
} from "./helpers";

describe.skipIf(!hasDevEnv)("5 kişi sınırı", () => {
  const created: { id: string }[] = [];

  beforeAll(async () => {
    assertNotProd();
    await deleteLeftoverTestUsers();
  });

  afterAll(async () => {
    await deleteTestUsers(created);
  });

  it("5 profil varken 6. kullanıcı oluşturulamaz ve geride yarım kayıt kalmaz", async () => {
    const admin = serviceClient();
    const { data: limit } = await admin.rpc("max_profiles");
    expect(limit).toBe(5);

    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    const existing = count ?? 0;
    expect(existing).toBeLessThanOrEqual(5);

    for (let i = existing; i < 5; i++) {
      const { data, error } = await admin.auth.admin.createUser({
        email: testEmail(`dolgu${i}`),
        email_confirm: true,
      });
      expect(error).toBeNull();
      created.push({ id: data.user!.id });
    }

    const sixthEmail = testEmail("altinci");
    const { data, error } = await admin.auth.admin.createUser({
      email: sixthEmail,
      email_confirm: true,
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();

    const after = await admin.from("profiles").select("id", { count: "exact", head: true });
    expect(after.count).toBe(5);

    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    expect(users.data.users.some((user) => user.email === sixthEmail)).toBe(false);
  }, 120_000); // art arda çok sayıda ağ isteği yapar
});
