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

export const uuidSchema = z.uuid({ error: "Invalid record." });

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
      .max(LIMITS.tag, { error: `A tag can be at most ${LIMITS.tag} characters.` }),
  )
  .max(LIMITS.tags, { error: `At most ${LIMITS.tags} tags.` });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} can be at most ${max} characters.` })
    .transform((value) => (value === "" ? null : value));

export const cardInputSchema = z.object({
  front: z
    .string()
    .trim()
    .min(1, { error: "Front can't be empty." })
    .max(LIMITS.front, { error: `Front can be at most ${LIMITS.front} characters.` }),
  back: z
    .string()
    .trim()
    .min(1, { error: "Back can't be empty." })
    .max(LIMITS.back, { error: `Back can be at most ${LIMITS.back} characters.` }),
  example: optionalText(LIMITS.example, "Example").default(""),
  note: optionalText(LIMITS.note, "Note").default(""),
  tags: z.string().default("").transform(splitTags).pipe(tagsSchema),
});

export type CardInput = z.output<typeof cardInputSchema>;

export const deckInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Deck name can't be empty." })
      .max(LIMITS.deckName, { error: `Deck name can be at most ${LIMITS.deckName} characters.` }),
    source_lang: z.enum(LANGUAGE_CODES, { error: "Invalid language." }),
    target_lang: z.enum(LANGUAGE_CODES, { error: "Invalid language." }),
  })
  .refine((d) => d.source_lang !== d.target_lang, {
    error: "Word and meaning languages must be different.",
    path: ["target_lang"],
  });

export const cardListParamsSchema = z.object({
  q: z.string().trim().max(LIMITS.search).catch(""),
  tag: z.string().trim().max(LIMITS.tag).catch(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
  archived: z
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
  .min(1, { error: "Nothing to import." })
  .max(LIMITS.importRows, { error: `At most ${LIMITS.importRows} cards at once.` });
