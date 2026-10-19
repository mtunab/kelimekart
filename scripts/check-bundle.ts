/**
 * `next build` sonrası çalışır: tarayıcıya gönderilen dosyalarda gizli anahtar var mı diye bakar.
 * Bulursa hata kodu ile çıkar ve `pnpm verify` başarısız olur.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const staticDir = path.join(".next", "static");
const secrets = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_DB_PASSWORD].filter(
  (value): value is string => !!value && value.length >= 8,
);
const patterns = [
  /sb_secret_[A-Za-z0-9_-]{8,}/,
  /SUPABASE_SERVICE_ROLE_KEY/,
  /SUPABASE_DB_PASSWORD/,
];

const files = readdirSync(staticDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath, entry.name));

const leaks: string[] = [];
for (const file of files) {
  const content = readFileSync(file, "utf8");
  if (secrets.some((secret) => content.includes(secret)) || patterns.some((p) => p.test(content))) {
    leaks.push(file);
  }
}

if (leaks.length > 0) {
  console.error("GİZLİ BİLGİ İSTEMCİ PAKETİNDE BULUNDU:\n" + leaks.join("\n"));
  process.exit(1);
}
console.log(`İstemci paketi temiz: ${files.length} dosya tarandı, gizli anahtar yok.`);
