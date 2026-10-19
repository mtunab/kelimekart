import { expect, test } from "@playwright/test";
import { buildSetPasswordLink } from "../../scripts/lib/invite";
import {
  createAuthUser,
  deleteTestUsers,
  serviceClient,
  testEmail,
  type AuthUser,
} from "../security/helpers";
import { login, logout } from "./helpers";

test.describe("giriş", () => {
  let user: AuthUser;

  test.beforeAll(async () => {
    user = await createAuthUser("e2e", "Deniz");
  });

  test.afterAll(async () => {
    await deleteTestUsers([user]);
  });

  test("giriş yapmadan ana sayfa açılmaz, giriş sayfasına gider", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/login\?next=%2Freset-password$/);
  });

  test("yanlış şifre anlaşılır hata verir", async ({ page }) => {
    await login(page, user.email, "yanlis-sifre-123");
    await expect(page.getByText("E-posta veya şifre hatalı.")).toBeVisible();
    await expect(page.getByLabel("E-posta")).toHaveValue(user.email);
  });

  test("giriş → ana sayfa → çıkış", async ({ page }) => {
    await login(page, user.email, user.password);
    await expect(page.getByRole("heading", { name: "Merhaba, Deniz" })).toBeVisible();

    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);

    await logout(page);
    await expect(page.getByText("Çıkış yaptın.")).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("şifremi unuttum: kayıtlı olup olmadığını belli etmez", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Şifremi unuttum" }).click();
    await expect(page.getByRole("heading", { name: "Şifremi unuttum" })).toBeVisible();
    await page.getByLabel("E-posta").fill(testEmail("yok"));
    await page.getByRole("button", { name: "Sıfırlama bağlantısı gönder" }).click();
    await expect(page.getByText(/Bu adres kayıtlıysa/)).toBeVisible();
  });

  test("bozuk bağlantı giriş sayfasında uyarı gösterir", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=bozuk&type=recovery&next=/reset-password");
    await expect(page).toHaveURL(/\/login\?error=link$/);
    await expect(page.getByText(/Bağlantı geçersiz/)).toBeVisible();
  });
});

test.describe("davet bağlantısı", () => {
  let invited: AuthUser;

  test.beforeAll(async () => {
    invited = await createAuthUser("e2e", "Ece");
  });

  test.afterAll(async () => {
    await deleteTestUsers([invited]);
  });

  test("bağlantıyla şifre belirlenir ve yeni şifreyle girilir", async ({ page, baseURL }) => {
    const { data, error } = await serviceClient().auth.admin.generateLink({
      type: "recovery",
      email: invited.email,
    });
    expect(error).toBeNull();
    const link = buildSetPasswordLink(baseURL!, data.properties!.hashed_token);

    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password$/);

    await page.getByLabel("Yeni şifre", { exact: true }).fill("kisa");
    await page.getByLabel("Yeni şifre (tekrar)").fill("kisa");
    await page.getByRole("button", { name: "Şifreyi kaydet" }).click();
    await expect(page.getByText(/en az 8 karakter olmalı/)).toBeVisible();

    const newPassword = `Yeni-${crypto.randomUUID().slice(0, 12)}`;
    await page.getByLabel("Yeni şifre", { exact: true }).fill(newPassword);
    await page.getByLabel("Yeni şifre (tekrar)").fill(newPassword);
    await page.getByRole("button", { name: "Şifreyi kaydet" }).click();
    await expect(page.getByText("Şifren kaydedildi.")).toBeVisible();

    await logout(page);
    await login(page, invited.email, newPassword);
    await expect(page.getByRole("heading", { name: "Merhaba, Ece" })).toBeVisible();

    // Aynı bağlantı ikinci kez kullanılamaz.
    await logout(page);
    await page.goto(link);
    await expect(page).toHaveURL(/\/login\?error=link$/);
  });
});
