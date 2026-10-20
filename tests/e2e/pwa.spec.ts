import { expect, test } from "@playwright/test";
import { createAuthUser, deleteTestUsers, type AuthUser } from "../security/helpers";
import { login } from "./helpers";

test.describe("PWA ve güvenlik başlıkları", () => {
  test.skip(({ isMobile }) => isMobile, "Masaüstünde bir kez yeterli.");

  test("manifest, ikonlar ve servis çalışanı girişsiz erişilebilir", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const json = await manifest.json();
    expect(json).toMatchObject({ name: "KelimeKart", display: "standalone", start_url: "/" });
    const sizes = json.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(json.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);

    for (const icon of json.icons) {
      const res = await request.get(icon.src);
      expect(res.ok(), icon.src).toBe(true);
      expect(res.headers()["content-type"]).toContain("image/png");
    }

    const sw = await request.get("/sw.js");
    expect(sw.ok()).toBe(true);
    expect(sw.headers()["cache-control"]).toContain("no-store");
    expect(await sw.text()).toContain("OFFLINE_URL");

    const offline = await request.get("/offline.html");
    expect(offline.ok()).toBe(true);
    expect(await offline.text()).toContain("İnternet bağlantısı yok");
  });

  test("güvenlik başlıkları her sayfada", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toContain("default-src 'self'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test.describe("kurulabilirlik", () => {
    let user: AuthUser;
    test.beforeAll(async () => {
      user = await createAuthUser("e2e", "Pwa");
    });
    test.afterAll(async () => {
      await deleteTestUsers([user]);
    });

    test("Chrome uygulamayı kurulabilir buluyor, servis çalışanı devrede", async ({ page }) => {
      await login(page, user.username, user.password);
      await expect(page.getByRole("heading", { name: "Merhaba, Pwa" })).toBeVisible();
      await page.waitForFunction(async () =>
        Boolean(await navigator.serviceWorker.getRegistration()),
      );
      const cdp = await page.context().newCDPSession(page);
      const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
      expect(installabilityErrors).toEqual([]);
    });
  });
});
