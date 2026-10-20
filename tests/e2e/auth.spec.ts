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
    await expect(page.getByText("Wrong username or password.")).toBeVisible();
    await expect(page.getByLabel("Username")).toHaveValue(user.username);
  });

  test("kullanıcı adıyla giriş (büyük harfle yazsa da) → ana sayfa → çıkış", async ({ page }) => {
    await login(page, user.username.toUpperCase(), user.password);
    await expect(page.getByRole("heading", { name: /^Hi, Deniz/ })).toBeVisible();

    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);

    await logout(page);
    await expect(page.getByText("You've logged out.")).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("ayarlarda kullanıcı adı görünür", async ({ page }) => {
    await login(page, user.username, user.password);
    await expect(page.getByRole("heading", { name: /^Hi, Deniz/ })).toBeVisible();
    await page.goto("/settings");
    await expect(page.getByText(`Your username: ${user.username}`)).toBeVisible();
  });

  test("şifremi unuttum: yöneticiye başvurmayı anlatır", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Forgot password" })).toBeVisible();
    await expect(page.getByText(/the group admin creates accounts/)).toBeVisible();
    await page.getByRole("link", { name: "Back to log in" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("yönetici şifreyi yenileyince eski şifre çalışmaz, yenisi çalışır", async ({ page }) => {
    const newPassword = `Yeni-${crypto.randomUUID().slice(0, 12)}`;
    const { error } = await serviceClient().auth.admin.updateUserById(user.id, {
      password: newPassword,
    });
    expect(error).toBeNull();

    await login(page, user.username, user.password);
    await expect(page.getByText("Wrong username or password.")).toBeVisible();
    await login(page, user.username, newPassword);
    await expect(page.getByRole("heading", { name: /^Hi, Deniz/ })).toBeVisible();
    user.password = newPassword;
  });
});
