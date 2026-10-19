import type { Metadata } from "next";
import Link from "next/link";
import { setCardArchived } from "@/app/decks/actions";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { requireDeck } from "@/lib/decks";
import { languageLabel } from "@/lib/languages";
import { cardListParamsSchema, LIMITS } from "@/lib/validation/cards";
import { QuickAdd } from "./quick-add";

export const metadata: Metadata = { title: "Deste · KelimeKart" };

type CardRow = {
  id: string;
  front: string;
  back: string;
  example: string | null;
  tags: string[];
  archived: boolean;
  total_count: number;
};

export default async function DeckPage({ params, searchParams }: PageProps<"/decks/[deckId]">) {
  const { deckId } = await params;
  const [{ supabase, profile, deck, isOwner }, rawSearch] = await Promise.all([
    requireDeck(deckId),
    searchParams,
  ]);
  const { q, etiket, sayfa, arsiv } = cardListParamsSchema.parse(rawSearch);
  const pageSize = LIMITS.pageSize;

  const [cardsResult, tagsResult] = await Promise.all([
    supabase.rpc("search_cards", {
      p_deck_id: deck.id,
      p_query: q || null,
      p_tag: etiket || null,
      p_archived: arsiv,
      p_limit: pageSize,
      p_offset: (sayfa - 1) * pageSize,
    }),
    supabase.rpc("deck_tags", { p_deck_id: deck.id }),
  ]);
  const cards = (cardsResult.data ?? []) as CardRow[];
  const total = cards[0] ? Number(cards[0].total_count) : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const tags = (tagsResult.data ?? []) as { tag: string; card_count: number }[];
  const filtering = Boolean(q || etiket);

  const href = (overrides: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, etiket, sayfa: 1, arsiv: arsiv ? "1" : "", ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && !(key === "sayfa" && value === 1)) {
        sp.set(key, String(value));
      }
    }
    const qs = sp.toString();
    return `/decks/${deck.id}${qs ? `?${qs}` : ""}`;
  };

  return (
    <PageShell displayName={profile.display_name}>
      {rawSearch.durum === "kaydedildi" ? <Alert tone="success">Kart kaydedildi.</Alert> : null}

      <div className="flex flex-col gap-1">
        <Link
          href="/"
          className="self-start rounded-md py-1 text-sm text-indigo-700 dark:text-indigo-300"
        >
          ← Desteler
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{deck.name}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {languageLabel(deck.source_lang)} → {languageLabel(deck.target_lang)}
          {deck.archived ? " · arşivde" : ""}
        </p>
      </div>

      <nav aria-label="Deste işlemleri" className="flex flex-wrap gap-2">
        <Link href={`/study?deste=${deck.id}`} className={buttonClass("primary")}>
          Çalış
        </Link>
        <Link href={`/decks/${deck.id}/import`} className={buttonClass("secondary")}>
          İçe aktar
        </Link>
        <a href={`/decks/${deck.id}/export`} className={buttonClass("secondary")} download>
          CSV indir
        </a>
        <Link href={`/decks/${deck.id}/members`} className={buttonClass("secondary")}>
          Üyeler
        </Link>
        {isOwner ? (
          <Link href={`/decks/${deck.id}/settings`} className={buttonClass("secondary")}>
            Ayarlar
          </Link>
        ) : null}
      </nav>

      {!deck.archived ? (
        <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-2 text-lg font-semibold">Kelime ekle</h2>
          <QuickAdd deckId={deck.id} frontLang={deck.source_lang} backLang={deck.target_lang} />
        </section>
      ) : null}

      <section aria-labelledby="kartlar" className="flex flex-col gap-3">
        <h2 id="kartlar" className="text-lg font-semibold">
          {arsiv ? "Arşivdeki kartlar" : "Kartlar"}{" "}
          <span className="font-normal text-zinc-500">({total})</span>
        </h2>

        <form method="get" className="flex gap-2" role="search">
          {etiket ? <input type="hidden" name="etiket" value={etiket} /> : null}
          {arsiv ? <input type="hidden" name="arsiv" value="1" /> : null}
          <label htmlFor="q" className="sr-only">
            Kartlarda ara
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Kelime, anlam veya etiket ara"
            maxLength={LIMITS.search}
            className={inputClass}
          />
          <button type="submit" className={buttonClass("secondary")}>
            Ara
          </button>
        </form>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Etikete göre filtrele">
            {etiket ? (
              <Link href={href({ etiket: undefined })} className={tagClass(false)}>
                Tüm etiketler ✕
              </Link>
            ) : null}
            {tags.map((t) => (
              <Link
                key={t.tag}
                href={href({ etiket: t.tag === etiket ? undefined : t.tag })}
                className={tagClass(t.tag === etiket)}
                aria-current={t.tag === etiket ? "true" : undefined}
              >
                #{t.tag} <span className="opacity-60">{t.card_count}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {cards.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            {filtering
              ? "Aramana uyan kart yok."
              : arsiv
                ? "Arşivde kart yok."
                : "Henüz kelime yok. Yukarıdan ilk kelimeni ekle ya da toplu içe aktar."}
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {cards.map((card) => (
              <li key={card.id} className="flex items-center gap-2 p-3">
                <Link
                  href={`/decks/${deck.id}/cards/${card.id}`}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-1"
                >
                  <span className="truncate font-medium" lang={deck.source_lang}>
                    {card.front}
                  </span>
                  <span
                    className="truncate text-sm text-zinc-600 dark:text-zinc-400"
                    lang={deck.target_lang}
                  >
                    {card.back}
                    {card.tags.length ? (
                      <span className="text-zinc-400">
                        {" "}
                        · {card.tags.map((t) => `#${t}`).join(" ")}
                      </span>
                    ) : null}
                  </span>
                </Link>
                <form action={setCardArchived}>
                  <input type="hidden" name="deckId" value={deck.id} />
                  <input type="hidden" name="cardId" value={card.id} />
                  <input type="hidden" name="archived" value={String(!card.archived)} />
                  <button
                    type="submit"
                    className={buttonClass("ghost", "text-sm")}
                    aria-label={`${card.front} kartını ${card.archived ? "arşivden çıkar" : "arşivle"}`}
                  >
                    {card.archived ? "Geri al" : "Arşivle"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Sayfalar" className="flex items-center justify-between gap-2">
            {sayfa > 1 ? (
              <Link href={href({ sayfa: sayfa - 1 })} className={buttonClass("secondary")}>
                ← Önceki
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              Sayfa {sayfa} / {pageCount}
            </span>
            {sayfa < pageCount ? (
              <Link href={href({ sayfa: sayfa + 1 })} className={buttonClass("secondary")}>
                Sonraki →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}

        <Link
          href={href({ arsiv: arsiv ? "" : "1" })}
          className={buttonClass("ghost", "self-start text-sm")}
        >
          {arsiv ? "Etkin kartlara dön" : "Arşivdeki kartları göster"}
        </Link>
      </section>
    </PageShell>
  );
}

function tagClass(active: boolean) {
  return [
    "inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-sm",
    active
      ? "border-indigo-600 bg-indigo-600 text-white"
      : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
  ].join(" ");
}
