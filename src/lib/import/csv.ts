/** CSV dışa aktarma (saf fonksiyon). Excel Türkçe karakterleri doğru göstersin diye UTF-8 BOM eklenir. */

export type ExportCard = {
  front: string;
  back: string;
  example: string | null;
  note: string | null;
  tags: string[];
};

export const CSV_HEADER = ["front", "back", "example", "note", "tags"] as const;

function escapeCell(value: string): string {
  // Excel'de formül olarak çalıştırılmasın (CSV enjeksiyonu): =, +, -, @ ile başlayanlara ' ekle.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function cardsToCsv(cards: ExportCard[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const card of cards) {
    lines.push(
      [card.front, card.back, card.example ?? "", card.note ?? "", card.tags.join("|")]
        .map(escapeCell)
        .join(","),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** İndirilen dosyanın adı: "Meyveler" → "kelimekart-meyveler.csv" */
export function csvFileName(deckName: string): string {
  const slug = deckName
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `kelimekart-${slug || "deste"}.csv`;
}
