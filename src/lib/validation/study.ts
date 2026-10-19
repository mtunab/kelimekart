import { z } from "zod";

/** İstemciden gelen cevap: sadece kart, puan ve olay kimliği. Gerisini sunucu hesaplar. */
export const reviewInputSchema = z.object({
  cardId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  clientEventId: z.uuid(),
});

export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const undoInputSchema = z.object({
  logId: z.number().int().positive(),
});
