/**
 * Yedek alma (JSON dışa aktarım) — SADECE OKUR, hiçbir şeyi değiştirmez.
 *
 *   pnpm backup            → dev veritabanının yedeği
 *   pnpm backup --prod     → canlı (prod) veritabanının yedeği
 *
 * Dosya `backups/kelimekart-<ortam>-<tarih>.json` olarak kaydedilir. Bu klasör GitHub'a gitmez.
 * Kişisel veri içerir: güvenli bir yerde (ör. kendi bulut sürücün) sakla.
 */
import "./flaky-network.cjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { createBackup } from "./lib/backup";

async function main() {
  const prod = process.argv.includes("--prod");
  config({ path: prod ? ".env.prod.local" : ".env.local", quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
    process.exit(1);
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const env = prod ? "prod" : "dev";

  const backup = await createBackup(admin, env);
  const stamp = backup.createdAt.replace(/[:.]/g, "-").slice(0, 19);
  mkdirSync("backups", { recursive: true });
  const file = path.join("backups", `kelimekart-${env}-${stamp}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 2));

  console.log(`✓ Yedek alındı (${env}): ${file}`);
  for (const [table, rows] of Object.entries(backup.tables)) {
    console.log(`  ${table.padEnd(17)} ${rows.length}`);
  }
  console.log(`  kullanıcı          ${backup.users.length}`);
}

main().catch((error: unknown) => {
  console.error(`Yedek alınamadı: ${(error as Error).message}`);
  process.exit(1);
});
