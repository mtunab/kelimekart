import { z } from "zod";
import { usernameSchema } from "@/lib/username";

export type UserCommand =
  | { action: "add"; username: string; displayName: string; prod: boolean }
  | { action: "password"; username: string; prod: boolean }
  | { action: "remove"; username: string; prod: boolean }
  | { action: "list"; prod: boolean };

export const USER_USAGE = [
  "Kullanım:",
  '  pnpm user add <kullanıcı-adı> "<Görünen ad>" [--prod]   → hesap açar (şifreyi gizli sorar)',
  "  pnpm user password <kullanıcı-adı> [--prod]             → şifreyi yeniler (gizli sorar)",
  "  pnpm user remove <kullanıcı-adı> [--prod]               → hesabı siler (onay ister)",
  "  pnpm user list [--prod]                                 → hesapları listeler",
].join("\n");

const displayNameSchema = z.string().trim().min(1).max(40);

/** Komut satırını okur. Şifre asla argüman olarak alınmaz (ekranda/geçmişte kalmasın). */
export function parseUserArgs(argv: string[]): UserCommand {
  const prod = argv.includes("--prod");
  const rest = argv.filter((a) => a !== "--prod" && a !== "--");
  const [action, rawUsername, ...nameParts] = rest;

  if (action === "list") return { action, prod };
  if (action !== "add" && action !== "password" && action !== "remove") {
    throw new Error(USER_USAGE);
  }
  const username = usernameSchema.safeParse(rawUsername ?? "");
  if (!username.success) {
    throw new Error(username.error.issues[0]?.message ?? "Geçersiz kullanıcı adı.");
  }
  if (action !== "add") return { action, username: username.data, prod };

  const displayName = displayNameSchema.safeParse(nameParts.join(" ") || username.data);
  if (!displayName.success) throw new Error("Görünen ad 1-40 karakter olmalı.");
  return { action, username: username.data, displayName: displayName.data, prod };
}
