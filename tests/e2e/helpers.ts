import { expect, type Page } from "@playwright/test";

export async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
}

/** Çıkış yapar ve çıkışın gerçekten tamamlanmasını bekler. */
export async function logout(page: Page) {
  await page.getByRole("button", { name: "Çıkış" }).click();
  await expect(page).toHaveURL(/\/login\?durum=cikis$/);
}
