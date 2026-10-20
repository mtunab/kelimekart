import type { SupabaseClient } from "@supabase/supabase-js";

/** Yedeklenen tablolar, geri yükleme (bağımlılık) sırasıyla. */
export const BACKUP_TABLES = [
  { name: "profiles", key: "id" },
  { name: "decks", key: "id" },
  { name: "deck_members", key: "deck_id,user_id" },
  { name: "cards", key: "id" },
  { name: "card_progress", key: "user_id,card_id" },
  { name: "review_logs", key: "id" },
  { name: "review_log_undos", key: "log_id" },
] as const;

export type TableName = (typeof BACKUP_TABLES)[number]["name"];
type Row = Record<string, unknown>;

export type Backup = {
  format: "kelimekart-backup";
  version: 1;
  createdAt: string;
  source: string;
  /** Hesaplar (auth) yedeğe girmez; geri yüklemede kişilerin e-postasıyla eşleşme kontrolü için. */
  users: { id: string; email: string | null }[];
  tables: Record<TableName, Row[]>;
};

const PAGE = 1000;

async function readAll(admin: SupabaseClient, table: TableName): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .order(
        table === "deck_members"
          ? "deck_id"
          : table === "card_progress"
            ? "user_id"
            : table === "review_log_undos"
              ? "log_id"
              : "id",
      )
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} okunamadı: ${error.message}`);
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }
  return rows;
}

/** Tüm veriyi JSON olarak döndürür (sadece okuma). */
export async function createBackup(admin: SupabaseClient, source: string): Promise<Backup> {
  const tables = {} as Record<TableName, Row[]>;
  for (const t of BACKUP_TABLES) tables[t.name] = await readAll(admin, t.name);

  const users: Backup["users"] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`Kullanıcılar okunamadı: ${error.message}`);
    users.push(...data.users.map((u) => ({ id: u.id, email: u.email ?? null })));
    if (data.users.length < PAGE) break;
  }

  return {
    format: "kelimekart-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    source,
    users,
    tables,
  };
}

export function isBackup(value: unknown): value is Backup {
  const v = value as Backup;
  return (
    !!v &&
    v.format === "kelimekart-backup" &&
    v.version === 1 &&
    BACKUP_TABLES.every((t) => Array.isArray(v.tables?.[t.name]))
  );
}

export type RestoreReport = Record<TableName, number> & { skippedUsers: string[] };

/**
 * Yedeği geri yükler: satırları birincil anahtara göre "varsa güncelle, yoksa ekle" yapar
 * (mevcut verinin üstüne yazar, fazladan satırları SİLMEZ). Hesabı artık olmayan kişilerin
 * satırları atlanır (hesaplar yedekte yok; önce `pnpm invite` ile yeniden davet edilmeli).
 */
export async function restoreBackup(admin: SupabaseClient, backup: Backup): Promise<RestoreReport> {
  const existing = new Set<string>();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE });
    if (error) throw new Error(`Kullanıcılar okunamadı: ${error.message}`);
    data.users.forEach((u) => existing.add(u.id));
    if (data.users.length < PAGE) break;
  }
  const missing = new Set(backup.users.map((u) => u.id).filter((id) => !existing.has(id)));
  const userCols = ["id", "user_id", "owner_id"];
  const keep = (row: Row, table: TableName) =>
    !userCols.some((c) => c in row && missing.has(String(row[c]))) &&
    !(table === "profiles" && missing.has(String(row.id)));

  // Silinmiş kullanıcının destesine ait kartlar ve ilerlemeler de atlanır.
  const keptDecks = new Set(backup.tables.decks.filter((r) => keep(r, "decks")).map((r) => r.id));
  const keptCards = new Set(
    backup.tables.cards.filter((r) => keptDecks.has(r.deck_id)).map((r) => r.id),
  );
  const keptLogs = new Set(
    backup.tables.review_logs
      .filter((r) => keep(r, "review_logs") && keptCards.has(r.card_id))
      .map((r) => r.id),
  );

  const report = { skippedUsers: [...missing] } as RestoreReport;
  for (const t of BACKUP_TABLES) {
    let rows = backup.tables[t.name].filter((r) => keep(r, t.name));
    if (t.name === "deck_members") rows = rows.filter((r) => keptDecks.has(r.deck_id));
    if (t.name === "cards") rows = rows.filter((r) => keptDecks.has(r.deck_id));
    if (t.name === "card_progress") rows = rows.filter((r) => keptCards.has(r.card_id));
    if (t.name === "review_logs") rows = rows.filter((r) => keptLogs.has(r.id));
    if (t.name === "review_log_undos") rows = rows.filter((r) => keptLogs.has(r.log_id));
    // created_by artık olmayan biri ise boşalt.
    if (t.name === "cards") {
      rows = rows.map((r) => (missing.has(String(r.created_by)) ? { ...r, created_by: null } : r));
    }

    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await admin.from(t.name).upsert(chunk, { onConflict: t.key });
      if (error) throw new Error(`${t.name} geri yüklenemedi: ${error.message}`);
    }
    report[t.name] = rows.length;
  }

  const { error } = await admin.rpc("sync_review_logs_sequence");
  if (error) throw new Error(`Sayaç güncellenemedi: ${error.message}`);
  return report;
}
