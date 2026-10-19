/**
 * Migration'ları bulut Supabase veritabanına uygular.
 *
 *   pnpm db:status          → dev veritabanında hangi migration'lar uygulanmış
 *   pnpm db:push            → bekleyen migration'ları dev veritabanına uygular
 *   pnpm db:push -- --prod  → prod'a uygular (.env.production.local, onay ister)
 *
 * Bağlantı adresi `SUPABASE_DB_URL` değişkeninden okunur ve asla ekrana yazılmaz.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import readline from "node:readline/promises";
import { config } from "dotenv";
import { buildDbUrl } from "./lib/db-url";

const args = process.argv.slice(2);
const command = args[0];
const isProd = args.includes("--prod");

if (command !== "push" && command !== "status") {
  console.error("Kullanım: tsx scripts/db.ts <push|status> [--prod]");
  process.exit(1);
}

const envFile = isProd ? ".env.production.local" : ".env.local";
config({ path: envFile, quiet: true });

const dbUrlTemplate = process.env.SUPABASE_DB_URL;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
if (!dbUrlTemplate) {
  console.error(`SUPABASE_DB_URL bulunamadı (${envFile} dosyasına bakıldı).`);
  process.exit(1);
}
let dbUrl: string;
try {
  dbUrl = buildDbUrl(dbUrlTemplate, dbPassword);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

async function confirmProd() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('PROD veritabanına yazılacak. Devam için "prod" yaz: ');
  rl.close();
  if (answer.trim() !== "prod") {
    console.error("İptal edildi.");
    process.exit(1);
  }
}

async function main() {
  if (isProd && command === "push") await confirmProd();

  const require = createRequire(import.meta.url);
  const cliPath = path.join(
    path.dirname(require.resolve("supabase/package.json")),
    "dist",
    "supabase.js",
  );
  const cliArgs =
    command === "push"
      ? ["db", "push", "--db-url", dbUrl, "--include-all"]
      : ["migration", "list", "--db-url", dbUrl];

  console.log(`→ ${isProd ? "PROD" : "dev"} veritabanı: ${command}`);
  const result = spawnSync(process.execPath, [cliPath, ...cliArgs], {
    stdio: ["inherit", "pipe", "pipe"],
    encoding: "utf8",
  });
  // CLI hata mesajlarında bağlantı adresi geçebilir; şifre sızmasın diye gizle.
  const secrets = [dbUrl, dbPassword, dbPassword && encodeURIComponent(dbPassword)].filter(
    (value): value is string => !!value,
  );
  const mask = (text: string) =>
    secrets.reduce((out, secret) => out.split(secret).join("<GİZLİ>"), text);
  process.stdout.write(mask(result.stdout ?? ""));
  process.stderr.write(mask(result.stderr ?? ""));
  process.exit(result.status ?? 1);
}

void main();
