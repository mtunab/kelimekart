/**
 * Commit öncesi: hazırlanan değişikliklerde gerçek gizli anahtar/şifre ya da .env dosyası var mı?
 * Kullanım: git add -A && pnpm check:staged
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { config, parse } from "dotenv";

config({ path: ".env.local", quiet: true });
const secrets = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_DB_PASSWORD];
try {
  const prod = parse(readFileSync(".env.prod.local"));
  secrets.push(prod.SUPABASE_SERVICE_ROLE_KEY, prod.SUPABASE_DB_PASSWORD);
} catch {
  // prod dosyası yok
}

const diff = execSync("git diff --cached", { maxBuffer: 100_000_000 }).toString();
const files = execSync("git diff --cached --name-only").toString().split("\n");
const secretInDiff = secrets.some((s) => s && s.length >= 8 && diff.includes(s));
const envFileStaged = files.some((f) => /^\.env/.test(f) && f !== ".env.example");

if (secretInDiff || envFileStaged) {
  console.error("!!! GİZLİ BİLGİ COMMIT'E GİRİYOR — commit yapma.");
  process.exit(1);
}
console.log("Commit temiz: gizli bilgi yok.");
