import { expect, test } from "@playwright/test";
import { createAuthUser, deleteTestUsers, type AuthUser } from "../security/helpers";
import { login, logout } from "./helpers";

test.describe("ayarlar", () => {
  test.skip(({ isMobile }) => isMobile, "Masaüstünde yeterli.");
  let user: AuthUser;

  test.beforeAll(async () => {
    user = await createAuthUser("e2e", "Ayar");
  });
  test.afterAll(async () => {
    await deleteTestUsers([user]);
  });

  test("ad, hedef, tema ve şifre değişir", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, user.email, user.password);
    await page.getByRole("link", { name: "Ayarlar" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();

    // Hatalı değer anlaşılır mesaj verir.
    await page.getByLabel("Günlük yeni kart").fill("500");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("En fazla 200.")).toBeVisible();

    await page.getByLabel("Görünen ad").fill("Ayar Yeni");
    await page.getByLabel("Günlük yeni kart").fill("15");
    await page.getByLabel("Günlük tekrar hedefi").fill("50");
    await page.getByLabel("Saat dilimi").selectOption("Europe/Berlin");
    await page.getByRole("button", { name: "Kaydet" }).click();
    await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Görünen ad")).toHaveValue("Ayar Yeni");
    await expect(page.getByLabel("Günlük yeni kart")).toHaveValue("15");
    await expect(page.getByLabel("Saat dilimi")).toHaveValue("Europe/Berlin");

    // Tema
    await page.getByRole("button", { name: "Koyu" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Açık" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Şifre değiştir → yeni şifreyle giriş
    const newPassword = `Yeni-${crypto.randomUUID().slice(0, 12)}`;
    await page.getByLabel("Yeni şifre", { exact: true }).fill(newPassword);
    await page.getByLabel("Yeni şifre (tekrar)").fill(newPassword);
    await page.getByRole("button", { name: "Şifreyi değiştir" }).click();
    await expect(page.getByText("Şifren değişti.")).toBeVisible();
    await logout(page);
    await login(page, user.email, newPassword);
    await expect(page.getByRole("heading", { name: "Merhaba, Ayar Yeni" })).toBeVisible();
  });
});
