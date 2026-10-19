require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const diff = require("child_process").execSync("git diff --cached", { maxBuffer: 1e8 }).toString();
const secrets = [process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_DB_PASSWORD];
try { const p = require("dotenv").parse(fs.readFileSync(".env.prod.local")); secrets.push(p.SUPABASE_SERVICE_ROLE_KEY, p.SUPABASE_DB_PASSWORD); } catch {}
const hit = secrets.filter((s) => s && s.length >= 8).some((s) => diff.includes(s));
const staged = require("child_process").execSync("git diff --cached --name-only").toString();
const envStaged = staged.split("\n").some((f) => /^\.env/.test(f) && f !== ".env.example");
if (hit || envStaged) { console.error("!!! GİZLİ BİLGİ COMMIT'E GİRİYOR"); process.exit(1); }
console.log("commit temiz");
