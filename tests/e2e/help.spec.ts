import { expect, test } from "@playwright/test";

test("yardım sayfası girişsiz açılır ve giriş sayfasından bağlantısı var", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Nasıl kullanılır?" }).click();
  await expect(page).toHaveURL(/\/yardim$/);
  await expect(page.getByRole("heading", { level: 1, name: "Kullanım kılavuzu" })).toBeVisible();
  for (const section of [
    "1. İlk giriş",
    "2. Deste ve kelime ekleme",
    "3. Çalışma",
    "5. Sorun olursa",
  ]) {
    await expect(page.getByRole("heading", { name: section })).toBeVisible();
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
