/** Deste rozeti için renkler; sıraya göre dönüşümlü. Üstündeki yazı her zaman siyah. */
const BADGE_COLORS = ["bg-teal", "bg-blue", "bg-pink", "bg-yellow"] as const;

/**
 * Deste listesinde adın yanındaki renkli kare: iki kelimeyse baş harfleri ("Daily English" → "DE"),
 * tek kelimeyse ilk iki harf ("Verbs" → "VE").
 */
export function deckBadge(name: string, index: number) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    words.length >= 2
      ? `${Array.from(words[0]!)[0]}${Array.from(words[1]!)[0]}`
      : Array.from(words[0] ?? "?")
          .slice(0, 2)
          .join("");
  const color =
    BADGE_COLORS[((index % BADGE_COLORS.length) + BADGE_COLORS.length) % BADGE_COLORS.length]!;
  return { initials: initials.toLocaleUpperCase("tr-TR"), color };
}
