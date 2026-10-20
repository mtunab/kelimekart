/**
 * Grup üyelerini yönetir (yalnızca yönetici, kendi bilgisayarından).
 *
 *   pnpm user add tuna "Tuna" --prod      → canlıda "tuna" hesabını açar, şifreyi gizli sorar
 *   pnpm user password tuna --prod        → şifreyi yeniler
 *   pnpm user remove ali --prod           → hesabı siler (onay ister)
 *   pnpm user list --prod                 → hesapları listeler
 *
 * --prod yazılmazsa dev (deneme) ortamında çalışır. Hesaplar kendiliğinden silinmez;
 * yalnızca bu komutla (ya da Supabase panelinden) silinir.
 */
import "./flaky-network.cjs";
import readline from "node:readline/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { usernameToEmail } from "@/lib/username";
import { newPasswordSchema } from "@/lib/validation/auth";
import { parseUserArgs, type UserCommand } from "./lib/user-args";

/** Klavye yerine yönlendirilmiş girdi (ör. otomasyon) için: tüm satırları bir kez okuyup sırayla verir. */
let pipedLines: string[] | null = null;
async function nextPipedLine(): Promise<string> {
  if (!pipedLines) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    pipedLines = Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
  }
  return pipedLines.shift() ?? "";
}

/** Şifreyi ekrana yazmadan (yıldızla) okur. */
async function askHidden(question: string): Promise<string> {
  const stdin = process.stdin;
  if (!stdin.isTTY) return nextPipedLine();
  process.stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          return resolve(value);
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          return reject(new Error("İptal edildi."));
        }
        if (ch === "\u0008" || ch === "\u007f") {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        value += ch;
        process.stdout.write("*");
      }
    };
    stdin.on("data", onData);
  });
}

async function askPasswordTwice(): Promise<string> {
  const password = await askHidden("Şifre (en az 8 karakter): ");
  const confirm = await askHidden("Şifre (tekrar): ");
  const parsed = newPasswordSchema.safeParse({ password, confirm });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Geçersiz şifre.");
  return parsed.data.password;
}

async function findUserId(admin: SupabaseClient, username: string): Promise<string | null> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error(`Kullanıcı aranamadı: ${error.message}`);
  return data?.id ?? null;
}

async function run(cmd: UserCommand, admin: SupabaseClient, env: string) {
  if (cmd.action === "list") {
    const { data, error } = await admin
      .from("profiles")
      .select("username, display_name, created_at")
      .order("created_at");
    if (error) throw new Error(error.message);
    console.log(`Hesaplar (${env}): ${data.length} / 5`);
    for (const p of data) console.log(`  ${p.username.padEnd(20)} ${p.display_name}`);
    return;
  }

  const existingId = await findUserId(admin, cmd.username);

  if (cmd.action === "add") {
    if (existingId)
      throw new Error(
        `"${cmd.username}" zaten var. Şifre için: pnpm user password ${cmd.username}`,
      );
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true });
    const { data: limit } = await admin.rpc("max_profiles");
    if (typeof count === "number" && typeof limit === "number" && count >= limit) {
      throw new Error(`Grup dolu: en fazla ${limit} kişi olabilir.`);
    }
    const password = await askPasswordTwice();
    const { error } = await admin.auth.admin.createUser({
      email: usernameToEmail(cmd.username),
      password,
      email_confirm: true,
      user_metadata: { username: cmd.username, display_name: cmd.displayName },
    });
    if (error) {
      throw new Error(
        error.code === "weak_password"
          ? "Şifre çok zayıf, daha güçlü bir şifre seç."
          : `Hesap açılamadı: ${error.message}`,
      );
    }
    console.log(
      `✓ "${cmd.username}" hesabı açıldı (${env}). Kullanıcı adı ve şifreyle giriş yapabilir.`,
    );
    return;
  }

  if (!existingId) throw new Error(`"${cmd.username}" diye bir hesap yok.`);

  if (cmd.action === "password") {
    const password = await askPasswordTwice();
    const { error } = await admin.auth.admin.updateUserById(existingId, { password });
    if (error) throw new Error(`Şifre değiştirilemedi: ${error.message}`);
    console.log(`✓ "${cmd.username}" şifresi yenilendi (${env}).`);
    return;
  }

  // remove
  console.log(
    `⚠️  "${cmd.username}" silinecek (${env}). Sahibi olduğu desteler ve kartları da silinir. Önce yedek al: pnpm backup${env === "CANLI" ? " --prod" : ""}`,
  );
  let answer: string;
  if (process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    answer = await rl.question(`Onaylamak için kullanıcı adını yaz (${cmd.username}): `);
    rl.close();
  } else {
    answer = await nextPipedLine();
  }
  if (answer.trim().toLowerCase() !== cmd.username) throw new Error("İptal edildi.");
  const { error } = await admin.auth.admin.deleteUser(existingId);
  if (error) throw new Error(`Silinemedi: ${error.message}`);
  console.log(`✓ "${cmd.username}" silindi (${env}).`);
}

async function main() {
  let cmd: UserCommand;
  try {
    cmd = parseUserArgs(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
  config({ path: cmd.prod ? ".env.prod.local" : ".env.local", quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
    process.exit(1);
  }
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    await run(cmd, admin, cmd.prod ? "CANLI" : "dev");
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

void main();
