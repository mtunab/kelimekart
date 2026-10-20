import { expect, test } from "@playwright/test";

test("yardım sayfası (/help) girişsiz açılır ve giriş sayfasından bağlantısı var", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "How does it work?" }).click();
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole("heading", { level: 1, name: "User guide" })).toBeVisible();
  for (const section of [
    "1. First login",
    "2. Decks and words",
    "3. Studying",
    "5. Troubleshooting",
  ]) {
    await expect(page.getByRole("heading", { name: section })).toBeVisible();
  }
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
