import { expect, test } from "@playwright/test";
import { createAuthUser, deleteTestUsers, serviceClient, type AuthUser } from "../security/helpers";
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
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  });

  test("yanlış şifre anlaşılır hata verir", async ({ page }) => {
    await login(page, user.username, "yanlis-sifre-123");
    await expect(page.getByText("Kullanıcı adı veya şifre hatalı.")).toBeVisible();
    await expect(page.getByLabel("Kullanıcı adı")).toHaveValue(user.username);
  });

  test("kullanıcı adıyla giriş (büyük harfle yazsa da) → ana sayfa → çıkış", async ({ page }) => {
    await login(page, user.username.toUpperCase(), user.password);
    await expect(page.getByRole("heading", { name: "Merhaba, Deniz" })).toBeVisible();

    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);

    await logout(page);
    await expect(page.getByText("Çıkış yaptın.")).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("ayarlarda kullanıcı adı görünür", async ({ page }) => {
    await login(page, user.username, user.password);
    await expect(page.getByRole("heading", { name: "Merhaba, Deniz" })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByText(`Kullanıcı adın: ${user.username}`)).toBeVisible();
  });

  test("şifremi unuttum: yöneticiye başvurmayı anlatır", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Şifremi unuttum" }).click();
    await expect(page.getByRole("heading", { name: "Şifremi unuttum" })).toBeVisible();
    await expect(page.getByText(/grup yöneticisi açar/)).toBeVisible();
    await page.getByRole("link", { name: "Girişe dön" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("yönetici şifreyi yenileyince eski şifre çalışmaz, yenisi çalışır", async ({ page }) => {
    const newPassword = `Yeni-${crypto.randomUUID().slice(0, 12)}`;
    const { error } = await serviceClient().auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    expect(error).toBeNull();

    await login(page, user.username, user.password);
    await expect(page.getByText("Kullanıcı adı veya şifre hatalı.")).toBeVisible();
    await login(page, user.username, newPassword);
    await expect(page.getByRole("heading", { name: "Merhaba, Deniz" })).toBeVisible();
    user.password = newPassword;
  });
});
