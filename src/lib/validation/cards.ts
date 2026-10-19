import { z } from "zod";
import { LANGUAGE_CODES } from "@/lib/languages";

export const LIMITS = {
  deckName: 80,
  front: 200,
  back: 500,
  example: 1000,
  note: 1000,
  tag: 30,
  tags: 10,
  search: 100,
  pageSize: 50,
  importRows: 2000,
} as const;

export const uuidSchema = z.uuid({ error: "Geçersiz kayıt." });

/** "a, b , c" → ["a","b","c"]: kırpılmış, boşlar atılmış, büyük/küçük harf duyarsız tekrarsız. */
export function splitTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[,|]/)) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    const key = tag.toLocaleLowerCase("tr-TR");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

const tagsSchema = z
  .array(
    z
      .string()
      .min(1)
      .max(LIMITS.tag, { error: `Etiket en fazla ${LIMITS.tag} karakter.` }),
  )
  .max(LIMITS.tags, { error: `En fazla ${LIMITS.tags} etiket.` });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} en fazla ${max} karakter.` })
    .transform((value) => (value === "" ? null : value));

export const cardInputSchema = z.object({
  front: z
    .string()
    .trim()
    .min(1, { error: "Ön yüz boş olamaz." })
    .max(LIMITS.front, { error: `Ön yüz en fazla ${LIMITS.front} karakter.` }),
  back: z
    .string()
    .trim()
    .min(1, { error: "Arka yüz boş olamaz." })
    .max(LIMITS.back, { error: `Arka yüz en fazla ${LIMITS.back} karakter.` }),
  example: optionalText(LIMITS.example, "Örnek cümle").default(""),
  note: optionalText(LIMITS.note, "Not").default(""),
  tags: z.string().default("").transform(splitTags).pipe(tagsSchema),
});

export type CardInput = z.output<typeof cardInputSchema>;

export const deckInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Deste adı boş olamaz." })
      .max(LIMITS.deckName, { error: `Deste adı en fazla ${LIMITS.deckName} karakter.` }),
    source_lang: z.enum(LANGUAGE_CODES, { error: "Geçersiz dil." }),
    target_lang: z.enum(LANGUAGE_CODES, { error: "Geçersiz dil." }),
  })
  .refine((d) => d.source_lang !== d.target_lang, {
    error: "Kaynak ve hedef dil farklı olmalı.",
    path: ["target_lang"],
  });

export const cardListParamsSchema = z.object({
  q: z.string().trim().max(LIMITS.search).catch(""),
  etiket: z.string().trim().max(LIMITS.tag).catch(""),
  sayfa: z.coerce.number().int().min(1).max(10_000).catch(1),
  arsiv: z
    .string()
    .optional()
    .transform((v) => v === "1")
    .catch(false),
});

/** İçe aktarma onayında sunucuya gelen satırlar. */
export const importRowsSchema = z
  .array(
    z.object({
      front: z.string().trim().min(1).max(LIMITS.front),
      back: z.string().trim().min(1).max(LIMITS.back),
      example: z.string().trim().max(LIMITS.example).nullable(),
      note: z.string().trim().max(LIMITS.note).nullable(),
      tags: tagsSchema,
    }),
  )
  .min(1, { error: "İçe aktarılacak kart yok." })
  .max(LIMITS.importRows, { error: `Tek seferde en fazla ${LIMITS.importRows} kart.` });
