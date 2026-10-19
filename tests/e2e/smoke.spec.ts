import { expect, test } from "@playwright/test";

test("ana sayfa açılır ve Türkçe başlık görünür", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("KelimeKart");
  await expect(page.getByRole("heading", { level: 1, name: "KelimeKart" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "tr");
});
