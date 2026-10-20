/**
 * Lighthouse (mobil) ölçümü — SADECE DEV. Canlı derlemeyi başlatır, geçici bir test kullanıcısıyla
 * giriş yapıp sayfaları ölçer, sonunda kullanıcıyı siler. Lighthouse projeye eklenmez (pnpm dlx).
 *   pnpm build && pnpm lighthouse
 * Hedef: Performance ≥ 85, Accessibility ≥ 90.
 */
import "./flaky-network.cjs";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const PORT = 3200;
const BASE = `http://localhost:${PORT}`;
const OUT = "lighthouse-results";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/login`);
      if (res.ok) return;
    } catch {
      // henüz açılmadı
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Sunucu açılmadı");
}

const server = spawn("pnpm", ["start", "--port", String(PORT)], {
  shell: true,
  stdio: "ignore",
  env: { ...process.env, NODE_OPTIONS: "--require ./scripts/flaky-network.cjs" },
});

const username = `kk-test-${crypto.randomUUID().slice(0, 8)}`;
const email = `${username}@users.kelimekart.invalid`;
const password = `Kk-${crypto.randomUUID()}`;
let userId: string | undefined;

try {
  await waitForServer();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: "Ölçüm" },
  });
  if (created.error || !created.data.user) {
    throw new Error(`Ölçüm kullanıcısı oluşturulamadı: ${created.error?.message}`);
  }
  userId = created.data.user.id;

  // Giriş yap, çerezleri al, gerçekçi veri için bir deste oluştur.
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Kullanıcı adı").fill(username);
  await page.getByLabel("Şifre", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL(`${BASE}/`);
  await page.getByLabel("Deste adı").fill("Ölçüm destesi");
  await page.getByRole("button", { name: "Deste oluştur" }).click();
  await page.waitForURL(/\/decks\//);
  const deckUrl = page.url();
  const deckId = deckUrl.split("/decks/")[1]!.split(/[?#]/)[0]!;
  await page.goto(`${deckUrl}/import`);
  await page
    .getByLabel("Kelimeler")
    .fill(Array.from({ length: 30 }, (_, i) => `word${i} ; kelime ${i}`).join("\n"));
  await page.getByRole("button", { name: "Önizle" }).click();
  await page.getByRole("button", { name: "30 kartı ekle" }).click();
  await page.getByText("30 kart eklendi.").waitFor();
  const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const chromePath = chromium.executablePath();
  await browser.close();

  mkdirSync(OUT, { recursive: true });
  const pages = [
    { name: "giris", url: `${BASE}/login`, auth: false },
    { name: "desteler", url: `${BASE}/`, auth: true },
    { name: "deste", url: `${BASE}/decks/${deckId}`, auth: true },
    { name: "calis", url: `${BASE}/study?deste=${deckId}`, auth: true },
    { name: "istatistik", url: `${BASE}/stats`, auth: true },
  ];
  const rows: string[] = [];
  for (const p of pages) {
    const out = path.join(OUT, `${p.name}.json`);
    const headersFile = path.join(OUT, "headers.json");
    writeFileSync(headersFile, JSON.stringify({ Cookie: cookie }));
    const args = [
      "dlx",
      "lighthouse@12.6.1",
      p.url,
      "--quiet",
      "--output=json",
      `--output-path=${out}`,
      "--only-categories=performance,accessibility,best-practices",
      `--chrome-path=${chromePath}`,
      '"--chrome-flags=--headless=new --no-sandbox"',
      ...(p.auth ? [`--extra-headers=${headersFile}`] : []),
    ];
    const result = spawnSync("pnpm", args, {
      shell: true,
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
    if (result.status !== 0) {
      rows.push(`${p.name}: HATA ${result.stderr.slice(-300)}`);
      continue;
    }
    const report = JSON.parse(readFileSync(out, "utf8"));
    const score = (k: string) => Math.round((report.categories[k]?.score ?? 0) * 100);
    const failedA11y = Object.values(
      report.audits as Record<
        string,
        { score: number | null; title: string; scoreDisplayMode: string }
      >,
    )
      .filter((a) => a.scoreDisplayMode === "binary" && a.score === 0)
      .map((a) => a.title)
      .slice(0, 8);
    rows.push(
      `${p.name.padEnd(11)} Performance ${score("performance")}  Accessibility ${score("accessibility")}  Best practices ${score("best-practices")}` +
        (failedA11y.length ? `\n             başarısız denetimler: ${failedA11y.join(" | ")}` : ""),
    );
  }
  writeFileSync(path.join(OUT, "ozet.txt"), rows.join("\n") + "\n");
  console.log(rows.join("\n"));
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
  server.kill();
  if (process.platform === "win32") {
    spawnSync("powershell", [
      "-NoProfile",
      "-Command",
      `Get-NetTCPConnection -LocalPort ${PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`,
    ]);
  }
}
