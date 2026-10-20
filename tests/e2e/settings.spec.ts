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
    await login(page, user.username, user.password);
    await page.getByRole("link", { name: "Settings" }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

    // Hatalı değer anlaşılır mesaj verir.
    await page.getByLabel("New cards per day").fill("500");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Maximum is 200.")).toBeVisible();

    await page.getByLabel("Display name").fill("Ayar Yeni");
    await page.getByLabel("New cards per day").fill("15");
    await page.getByLabel("Daily review goal").fill("50");
    await page.getByLabel("Time zone").selectOption("Europe/Berlin");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Settings saved.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue("Ayar Yeni");
    await expect(page.getByLabel("New cards per day")).toHaveValue("15");
    await expect(page.getByLabel("Time zone")).toHaveValue("Europe/Berlin");

    // Tema
    await page.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.goto("/settings");
    await page.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);

    // Şifre değiştir → yeni şifreyle giriş
    const newPassword = `Yeni-${crypto.randomUUID().slice(0, 12)}`;
    await page.getByLabel("New password", { exact: true }).fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await expect(page.getByText("Your password has been changed.")).toBeVisible();
    await logout(page);
    await login(page, user.username, newPassword);
    await expect(page.getByRole("heading", { name: /^Hi, Ayar Yeni/ })).toBeVisible();
  });
});
