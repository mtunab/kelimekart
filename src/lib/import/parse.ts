/**
 * Toplu içe aktarma ayrıştırıcısı (saf fonksiyon, tarayıcıda ve sunucuda çalışır).
 *
 * Desteklenen girişler:
 *   - "kelime ; anlam" satırları (noktalı virgül)
 *   - Sekmeyle ayrılmış (Excel/Sheets'ten kopyala-yapıştır)
 *   - CSV (virgül), tırnaklı alanlar ("a, b"), kaçışlı tırnak (""), çok satırlı tırnaklı alan
 * Sütun sırası: ön, arka, örnek, not, etiketler ("a|b" veya "a, b").
 * İlk satır başlık gibi görünüyorsa (ön/arka/front/back/kelime/anlam) atlanır.
 */
import { LIMITS, splitTags } from "@/lib/validation/cards";

export type ParsedCard = {
  line: number;
  front: string;
  back: string;
  example: string | null;
  note: string | null;
  tags: string[];
  /** Aynı girişte daha önce geçen kelime. */
  duplicateInInput: boolean;
};

export type ParseError = { line: number; message: string };

export type ParseResult = {
  delimiter: ";" | "\t" | ",";
  cards: ParsedCard[];
  errors: ParseError[];
};

const HEADER_WORDS = new Set([
  "front",
  "back",
  "ön",
  "on",
  "ön yüz",
  "arka",
  "arka yüz",
  "kelime",
  "anlam",
  "word",
  "meaning",
  "term",
  "definition",
]);

export function detectDelimiter(text: string): ";" | "\t" | "," {
  const sample = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(0, 20);
  const score = (d: string) => sample.filter((l) => l.includes(d)).length;
  const tab = score("\t");
  const semi = score(";");
  const comma = score(",");
  if (tab > 0 && tab >= semi && tab >= comma) return "\t";
  if (semi > 0 && semi >= comma) return ";";
  if (comma > 0) return ",";
  return ";";
}

/** RFC 4180 benzeri satır/sütun ayrıştırma. Her satırın başladığı satır numarasını da verir. */
export function splitRows(text: string, delimiter: string): { line: number; cells: string[] }[] {
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let rowStart = 1;
  let atCellStart = true;

  const pushCell = () => {
    cells.push(cell);
    cell = "";
    atCellStart = true;
  };
  const pushRow = () => {
    pushCell();
    rows.push({ line: rowStart, cells });
    cells = [];
  };

  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && atCellStart && cell.trim() === "") {
      inQuotes = true;
      cell = "";
      atCellStart = false;
      continue;
    }
    if (ch === delimiter) {
      pushCell();
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      pushRow();
      line++;
      rowStart = line;
      continue;
    }
    cell += ch;
    if (ch !== " ") atCellStart = false;
  }
  if (cell !== "" || cells.length > 0) pushRow();
  return rows.filter((r) => r.cells.some((c) => c.trim() !== ""));
}

function looksLikeHeader(cells: string[]): boolean {
  const first = cells[0]?.trim().toLocaleLowerCase("tr-TR") ?? "";
  const second = cells[1]?.trim().toLocaleLowerCase("tr-TR") ?? "";
  return HEADER_WORDS.has(first) && HEADER_WORDS.has(second);
}

/**
 * "Aynı kelime" anahtarı — veritabanındaki public.front_key ile birebir aynı:
 * küçük harf + birleşik nokta (U+0307) silinir. "İyi" = "iyi", ama "ılık" ≠ "ilik".
 */
export function normalizeFront(front: string): string {
  return front
    .trim()
    .toLowerCase()
    .replace(/\u0307/g, "");
}

export function parseImport(text: string): ParseResult {
  const delimiter = detectDelimiter(text);
  const rows = splitRows(text, delimiter);
  const cards: ParsedCard[] = [];
  const errors: ParseError[] = [];
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    if (index === 0 && looksLikeHeader(row.cells)) return;
    const [front = "", back = "", example = "", note = "", tags = ""] = row.cells.map((c) =>
      c.trim(),
    );

    if (!front) return void errors.push({ line: row.line, message: "Word is empty." });
    if (!back) return void errors.push({ line: row.line, message: `"${front}" has no meaning.` });
    if (front.length > LIMITS.front) {
      return void errors.push({ line: row.line, message: "Word is too long." });
    }
    if (back.length > LIMITS.back) {
      return void errors.push({ line: row.line, message: "Meaning is too long." });
    }
    if (example.length > LIMITS.example || note.length > LIMITS.note) {
      return void errors.push({ line: row.line, message: "Example or note is too long." });
    }
    const tagList = splitTags(tags);
    if (tagList.length > LIMITS.tags || tagList.some((t) => t.length > LIMITS.tag)) {
      return void errors.push({ line: row.line, message: "Invalid tags." });
    }

    const key = normalizeFront(front);
    const duplicateInInput = seen.has(key);
    seen.add(key);
    cards.push({
      line: row.line,
      front,
      back,
      example: example || null,
      note: note || null,
      tags: tagList,
      duplicateInInput,
    });
  });

  return { delimiter, cards, errors };
}
