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

/** Desteler sekmesinden yeni deste açar; deste sayfasına gider. */
async function createDeck(page: Page, name: string) {
  await page.goto("/decks");
  await page.getByLabel("Deck name").fill(name);
  await page.getByRole("button", { name: "Create deck" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function quickAdd(page: Page, front: string, back: string) {
  const frontInput = page.getByLabel("Word", { exact: true });
  await frontInput.fill(front);
  await frontInput.press("Enter"); // anlam boşken Enter → anlama geçer
  await expect(page.getByLabel("Meaning")).toBeFocused();
  await page.getByLabel("Meaning").fill(back);
  await page.getByLabel("Meaning").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: `Added: ${front}` })).toBeVisible();
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
    await login(page, user.username, user.password);

    // Ana sayfa = çalışma başlangıcı; deste yokken Desteler'e yönlendirir.
    await expect(page.getByText("Create your first deck to start studying.")).toBeVisible();
    await page.getByRole("link", { name: "Go to Decks" }).click();
    await expect(page.getByText("No decks yet")).toBeVisible();

    await createDeck(page, "E2E Deck");
    await expect(page.getByText("No words yet")).toBeVisible();

    for (const [front, back] of WORDS) await quickAdd(page, front, back);

    // Aynı kelime: ezilmez, "zaten var" denir.
    await page.getByLabel("Word", { exact: true }).fill("Apple");
    await page.getByLabel("Meaning").fill("başka anlam");
    await page.getByLabel("Meaning").press("Enter");
    await expect(
      page.getByRole("status").filter({ hasText: "is already in this deck" }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: /^Cards/ })).toContainText("(10)");

    // CSV içe aktarma: 3 yeni, 1 destede var, 1 listede tekrar, 1 bozuk satır.
    await page.getByRole("link", { name: "Import" }).click();
    await page
      .getByLabel("Words")
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
    await page.getByRole("button", { name: "Preview" }).click();
    await expect(page.getByText("will be added", { exact: false })).toContainText("3");
    await expect(page.getByText("Already in deck")).toBeVisible();
    await expect(page.getByText("Duplicate in list")).toBeVisible();
    await expect(page.getByText(/Line 7:/)).toBeVisible();
    await page.getByRole("button", { name: "Add 3 cards" }).click();
    await expect(page.getByText("3 cards added.")).toBeVisible();
    await page.getByRole("link", { name: "Back to deck" }).click();
    await expect(page.getByRole("heading", { name: /^Cards/ })).toContainText("(13)");

    // Arama
    await page.getByLabel("Search cards").fill("lamba");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("heading", { name: /^Cards/ })).toContainText("(1)");
    await expect(page.getByText("lamp, desk")).toBeVisible();

    // Dışa aktarma
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("kelimekart-e2e-deck.csv");
    const csv = readFileSync((await download.path())!, "utf8");
    expect(csv).toContain("front,back,example,note,tags");
    expect(csv).toContain('"lamp, desk",masa lambası');
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(14);

    // Çalışma: günlük yeni limit 10 → 10 kart. Klavyeyle: Boşluk = çevir, 4 = Kolay.
    await page
      .getByRole("navigation", { name: "Deck actions" })
      .getByRole("link", { name: "Study" })
      .click();
    await expect(page.getByTestId("study-card")).toBeVisible();
    await expect(page.getByText("10 new")).toBeVisible();

    // İlk cevabı geri al: kart geri gelir.
    const firstFront = await page.getByTestId("study-card").locator("p").first().innerText();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("study-card")).toHaveAttribute("data-flipped", "true");
    // Puan düğmeleri yok; kaydırma ipucu aralıkları gösterir.
    await expect(page.getByText(/← Again · \d+m/)).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Again|Hard|Good|Easy)/ })).toHaveCount(0);
    await page.keyboard.press("4");
    await expect(page.getByText("9 new")).toBeVisible();
    await page.keyboard.press("z");
    await expect(page.getByText(`Undone: ${firstFront}`)).toBeVisible();
    await expect(page.getByTestId("study-card").locator("p").first()).toHaveText(firstFront);

    for (let i = 0; i < 10; i++) {
      await expect(page.getByTestId("study-card")).toBeVisible();
      await page.keyboard.press("Space");
      await expect(page.getByTestId("study-card")).toHaveAttribute("data-flipped", "true");
      await page.keyboard.press("4");
    }
    await expect(page.getByRole("heading", { name: "Session complete!" })).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
    await expect(page.getByText(/1-day streak/)).toBeVisible();

    // Ana sayfa: bugünkü yeni kart hakkı bitti → "All caught up"; Desteler'de 3 yeni kart kaldı.
    // Desteden başlanan oturumda "Done" desteye döner.
    await page.getByRole("link", { name: "Done" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "E2E Deck" })).toBeVisible();
    await page.goto("/");
    await expect(page.getByText("All caught up!")).toBeVisible();
    await page.goto("/decks");
    await expect(page.getByText("3 new")).toBeVisible();

    // İstatistik güncellendi: 10 tekrar (geri alınan sayılmaz), %100, 1 günlük seri, panoda Selin.
    await page.goto("/stats");
    const today = page.locator("dl > div").filter({ hasText: "Today" });
    await expect(today.locator("dd").first()).toHaveText("10");
    await expect(
      page.locator("dl > div").filter({ hasText: "Accuracy" }).locator("dd").first(),
    ).toHaveText("100%");
    await expect(
      page.locator("dl > div").filter({ hasText: "Streak" }).locator("dd").first(),
    ).toHaveText("1 day");
    await expect(page.getByRole("listitem").filter({ hasText: "Selin (you)" })).toContainText(
      "10 reviews",
    );
    const deckRow = page.getByRole("row").filter({ hasText: "E2E Deck" });
    await expect(deckRow.getByRole("cell").nth(1)).toHaveText("3"); // yeni

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

  test("giriş → deste → 3 kelime → başlangıç ekranı → dokunarak çevir, kaydırarak cevapla", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await login(page, user.username, user.password);
    await expect(page.getByRole("heading", { name: /^Hi, Mert/ })).toBeVisible();
    await createDeck(page, "Mobile deck");
    for (const [front, back] of WORDS.slice(0, 3)) await quickAdd(page, front, back);

    // Yatay kaydırma çubuğu yok.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Alt menüden Study → başlangıç ekranı → Start studying.
    await page
      .getByRole("navigation", { name: "Bottom" })
      .getByRole("link", { name: "Study" })
      .click();
    await expect(page.getByRole("heading", { name: /^Hi, Mert/ })).toBeVisible();
    await page.getByRole("link", { name: /Start studying/ }).click();

    const card = page.getByTestId("study-card");
    for (let i = 0; i < 3; i++) {
      await expect(card).toBeVisible();
      await card.click(); // dokun = çevir
      await expect(card).toHaveAttribute("data-flipped", "true");
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
      // her kaydırmada "yeni" bir azalır, "vadesi gelen" bir artar.
      await expect(page.getByText(`${i + 1} due`, { exact: true })).toBeVisible();
      await expect(page.getByText(`${2 - i} new`, { exact: true })).toBeVisible();
    }

    await logout(page);
  });
});
