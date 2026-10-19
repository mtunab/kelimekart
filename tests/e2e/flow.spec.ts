import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createAuthUser, deleteTestUsers, type AuthUser } from "../security/helpers";
import { login, logout } from "./helpers";

const WORDS = [
  ["apple", "elma"],
  ["book", "kitap"],
  ["cat", "kedi"],
  ["dog", "köpek"],
  ["egg", "yumurta"],
  ["fish", "balık"],
  ["green", "yeşil"],
  ["house", "ev"],
  ["ice", "buz"],
  ["juice", "meyve suyu"],
] as const;

async function createDeck(page: Page, name: string) {
  await page.getByLabel("Deste adı").fill(name);
  await page.getByRole("button", { name: "Deste oluştur" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function quickAdd(page: Page, front: string, back: string) {
  const frontInput = page.getByLabel("Kelime", { exact: true });
  await frontInput.fill(front);
  await frontInput.press("Enter"); // anlam boşken Enter → anlama geçer
  await expect(page.getByLabel("Anlamı")).toBeFocused();
  await page.getByLabel("Anlamı").fill(back);
  await page.getByLabel("Anlamı").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: `Eklendi: ${front}` })).toBeVisible();
  await expect(frontInput).toHaveValue("");
  await expect(frontInput).toBeFocused();
}

test.describe("ana akış (masaüstü)", () => {
  test.skip(({ isMobile }) => isMobile, "Mobil için ayrı kısa akış var.");
  let user: AuthUser;

  test.beforeAll(async () => {
    user = await createAuthUser("e2e", "Selin");
  });
  test.afterAll(async () => {
    await deleteTestUsers([user]);
  });

  test("giriş → deste → 10 kelime → içe aktar → çalış → dışa aktar → çıkış", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, user.email, user.password);
    await expect(page.getByText("Henüz desten yok")).toBeVisible();

    await createDeck(page, "E2E Destesi");
    await expect(page.getByText("Henüz kelime yok")).toBeVisible();

    for (const [front, back] of WORDS) await quickAdd(page, front, back);

    // Aynı kelime: ezilmez, "zaten var" denir.
    await page.getByLabel("Kelime", { exact: true }).fill("Apple");
    await page.getByLabel("Anlamı").fill("başka anlam");
    await page.getByLabel("Anlamı").press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "zaten var" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: /Kartlar/ })).toContainText("(10)");

    // CSV içe aktarma: 3 yeni, 1 destede var, 1 listede tekrar, 1 bozuk satır.
    await page.getByRole("link", { name: "İçe aktar" }).click();
    await page
      .getByLabel("Kelimeler")
      .fill(
        [
          "word,meaning,example",
          "kite,uçurtma,I fly a kite.",
          '"lamp, desk",masa lambası,',
          "moon,ay,",
          "apple,elma,",
          "Kite,uçurtma 2,",
          "yalnız",
        ].join("\n"),
      );
    await page.getByRole("button", { name: "Önizle" }).click();
    await expect(page.getByText("yeni kart eklenecek", { exact: false })).toContainText("3");
    await expect(page.getByText("Destede zaten var")).toBeVisible();
    await expect(page.getByText("Listede tekrar")).toBeVisible();
    await expect(page.getByText(/Satır 7:/)).toBeVisible();
    await page.getByRole("button", { name: "3 kartı ekle" }).click();
    await expect(page.getByText("3 kart eklendi.")).toBeVisible();
    await page.getByRole("link", { name: "Desteye dön" }).click();
    await expect(page.getByRole("heading", { name: /Kartlar/ })).toContainText("(13)");

    // Arama
    await page.getByLabel("Kartlarda ara").fill("lamba");
    await page.getByRole("button", { name: "Ara" }).click();
    await expect(page.getByRole("heading", { name: /Kartlar/ })).toContainText("(1)");
    await expect(page.getByText("lamp, desk")).toBeVisible();

    // Dışa aktarma
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSV indir" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("kelimekart-e2e-destesi.csv");
    const csv = readFileSync((await download.path())!, "utf8");
    expect(csv).toContain("front,back,example,note,tags");
    expect(csv).toContain('"lamp, desk",masa lambası');
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(14);

    // Çalışma: günlük yeni limit 10 → 10 kart. Klavyeyle: Boşluk = çevir, 4 = Kolay.
    await page.getByRole("link", { name: "Çalış" }).click();
    await expect(page.getByTestId("study-card")).toBeVisible();
    await expect(page.getByText("10 yeni")).toBeVisible();

    // İlk cevabı geri al: kart geri gelir.
    const firstFront = await page.getByTestId("study-card").locator("p").first().innerText();
    await page.keyboard.press("Space");
    await expect(page.getByRole("button", { name: /Kolay/ })).toBeVisible();
    await page.keyboard.press("4");
    await expect(page.getByText("9 yeni")).toBeVisible();
    await page.keyboard.press("z");
    await expect(page.getByText(`Geri alındı: ${firstFront}`)).toBeVisible();
    await expect(page.getByTestId("study-card").locator("p").first()).toHaveText(firstFront);

    for (let i = 0; i < 10; i++) {
      await expect(page.getByTestId("study-card")).toBeVisible();
      await page.keyboard.press("Space");
      await expect(page.getByRole("button", { name: /Kolay/ })).toBeVisible();
      await page.keyboard.press("4");
    }
    await expect(page.getByRole("heading", { name: /Bugünlük bu kadar/ })).toBeVisible();
    await expect(page.getByText("%100")).toBeVisible();
    await expect(page.getByText(/1 günlük seri/)).toBeVisible();

    // Ana sayfa: kalan 3 yeni kart görünür.
    await page.getByRole("link", { name: "Tamam" }).click();
    await page.goto("/");
    await expect(page.getByText("3 yeni")).toBeVisible();

    await logout(page);
  });
});

test.describe("kısa akış (mobil 390px)", () => {
  test.skip(({ isMobile }) => !isMobile, "Sadece mobil.");
  let user: AuthUser;

  test.beforeAll(async () => {
    user = await createAuthUser("e2e", "Mert");
  });
  test.afterAll(async () => {
    await deleteTestUsers([user]);
  });

  test("giriş → deste → 3 kelime → dokunarak çevir ve kaydırarak cevapla", async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, user.email, user.password);
    await createDeck(page, "Mobil deste");
    for (const [front, back] of WORDS.slice(0, 3)) await quickAdd(page, front, back);

    // Yatay kaydırma çubuğu yok.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole("link", { name: "Çalış" }).click();
    const card = page.getByTestId("study-card");
    for (let i = 0; i < 3; i++) {
      await expect(card).toBeVisible();
      await card.click(); // dokun = çevir
      await expect(page.getByRole("button", { name: /İyi/ })).toBeVisible();
      const box = (await card.boundingBox())!;
      const y = box.y + box.height / 2;
      const x = box.x + box.width / 2;
      const dx = i === 0 ? -150 : 150; // ilk kart sola (Tekrar), diğerleri sağa (İyi)
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx / 2, y, { steps: 5 });
      await page.mouse.move(x + dx, y, { steps: 5 });
      await page.mouse.up();
      // Yeni kart (Tekrar da İyi de) öğrenme adımına girer ve dakikalar içinde yine gelir:
      // her kaydırmada "yeni" bir azalır, "tekrar" bir artar.
      await expect(page.getByText(`${i + 1} tekrar`)).toBeVisible();
      await expect(page.getByText(`${2 - i} yeni`)).toBeVisible();
    }

    await logout(page);
  });
});
