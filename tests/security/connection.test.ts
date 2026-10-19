import { beforeAll, describe, expect, it } from "vitest";
import { anonClient, anonKey, assertNotProd, devUrl, hasDevEnv, serviceClient } from "./helpers";

describe.skipIf(!hasDevEnv)("dev Supabase bağlantısı", () => {
  beforeAll(() => assertNotProd());

  it("sunucu ayarlarında herkese açık kayıt kapalı", async () => {
    const response = await fetch(`${devUrl}/auth/v1/settings`, { headers: { apikey: anonKey } });
    expect(response.ok).toBe(true);
    const settings = (await response.json()) as { disable_signup: boolean };
    expect(settings.disable_signup).toBe(true);
  });

  it("dışarıdan biri kendi kendine hesap açamaz", async () => {
    const email = `kayit-denemesi-${crypto.randomUUID()}@example.com`;
    const { data, error } = await anonClient().auth.signUp({
      email,
      password: `Deneme-${crypto.randomUUID()}`,
    });
    expect(error).not.toBeNull();
    expect(data.user).toBeNull();
  });

  it("gizli anahtar geçerli (yalnızca sunucu betikleri için)", async () => {
    const { error } = await serviceClient().auth.admin.listUsers({ page: 1, perPage: 1 });
    expect(error).toBeNull();
  });
});
