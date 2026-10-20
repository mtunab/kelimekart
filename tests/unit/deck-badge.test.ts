import { describe, expect, it } from "vitest";
import { deckBadge } from "@/lib/deck-badge";

describe("deste rozeti", () => {
  it("iki kelimede baş harfleri, tek kelimede ilk iki harfi alır", () => {
    expect(deckBadge("Daily English", 0).initials).toBe("DE");
    expect(deckBadge("verbs", 0).initials).toBe("VE");
    expect(deckBadge("  phrasal   verbs  ", 0).initials).toBe("PV");
  });

  it("Türkçe harfleri doğru büyütür", () => {
    expect(deckBadge("ilk ışık", 0).initials).toBe("İI");
    expect(deckBadge("şehir", 0).initials).toBe("ŞE");
  });

  it("boş ad için soru işareti koyar", () => {
    expect(deckBadge("   ", 0).initials).toBe("?");
  });

  it("renkleri sırayla döndürür", () => {
    const colors = [0, 1, 2, 3, 4].map((i) => deckBadge("x", i).color);
    expect(colors[0]).toBe(colors[4]);
    expect(new Set(colors.slice(0, 4)).size).toBe(4);
  });
});
