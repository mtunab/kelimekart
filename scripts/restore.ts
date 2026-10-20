/**
 * Yedekten geri yükleme. Var olan satırların üstüne yazar ("varsa güncelle, yoksa ekle");
 * yedekte olmayan yeni satırları SİLMEZ. Hesaplar (şifreler) yedekte yoktur: silinmiş bir kişinin
 * verisi geri gelsin isterseniz önce `pnpm invite` ile aynı kişiyi yeniden ekleyin.
 *
 *   pnpm restore backups/kelimekart-prod-....json          → dev'e geri yükler
 *   pnpm restore backups/kelimekart-prod-....json --prod   → canlıya geri yükler (onay ister)
 */
import "./flaky-network.cjs";
import { readFileSync } from "node:fs";
import readline from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { isBackup, restoreBackup } from "./lib/backup";

async function main() {
  const prod = process.argv.includes("--prod");
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("Kullanım: pnpm restore <yedek-dosyası.json> [--prod]");
    process.exit(1);
  }
  const backup: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!isBackup(backup)) {
    console.error("Bu dosya bir KelimeKart yedeği değil.");
    process.exit(1);
  }

  config({ path: prod ? ".env.prod.local" : ".env.local", quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
    process.exit(1);
  }

  console.log(`Yedek: ${backup.source}, ${backup.createdAt}`);
  if (prod) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      'CANLI veritabanına geri yüklenecek. Devam için "geri yükle" yaz: ',
    );
    rl.close();
    if (answer.trim() !== "geri yükle") {
      console.error("İptal edildi.");
      process.exit(1);
    }
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const report = await restoreBackup(admin, backup);
  console.log(`✓ Geri yüklendi (${prod ? "prod" : "dev"}):`);
  for (const [table, count] of Object.entries(report)) {
    if (table !== "skippedUsers") console.log(`  ${table.padEnd(17)} ${count}`);
  }
  if (report.skippedUsers.length) {
    console.log(
      `  Hesabı olmayan ${report.skippedUsers.length} kişinin verisi atlandı (önce yeniden davet edin).`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(`Geri yüklenemedi: ${(error as Error).message}`);
  process.exit(1);
});
