import type { Metadata } from "next";
import Link from "next/link";
import { setCardArchived } from "@/app/(app)/decks/actions";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { requireDeck } from "@/lib/decks";
import { languageLabel } from "@/lib/languages";
import { cardListParamsSchema, LIMITS } from "@/lib/validation/cards";
import { QuickAdd } from "./quick-add";

export const metadata: Metadata = { title: "Deck · KelimeKart" };

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
  const [{ supabase, deck, isOwner }, rawSearch] = await Promise.all([
    requireDeck(deckId),
    searchParams,
  ]);
  const { q, tag, page, archived } = cardListParamsSchema.parse(rawSearch);
  const pageSize = LIMITS.pageSize;

  const [cardsResult, tagsResult] = await Promise.all([
    supabase.rpc("search_cards", {
      p_deck_id: deck.id,
      p_query: q || null,
      p_tag: tag || null,
      p_archived: archived,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    }),
    supabase.rpc("deck_tags", { p_deck_id: deck.id }),
  ]);
  const cards = (cardsResult.data ?? []) as CardRow[];
  const total = cards[0] ? Number(cards[0].total_count) : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const tags = (tagsResult.data ?? []) as { tag: string; card_count: number }[];
  const filtering = Boolean(q || tag);

  const href = (overrides: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, tag, page: 1, archived: archived ? "1" : "", ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== "" && !(key === "page" && value === 1)) {
        sp.set(key, String(value));
      }
    }
    const qs = sp.toString();
    return `/decks/${deck.id}${qs ? `?${qs}` : ""}`;
  };

  return (
    <PageShell>
      {rawSearch.status === "saved" ? <Alert tone="success">Card saved.</Alert> : null}

      <div className="flex flex-col gap-1">
        <Link
          href="/decks"
          className="self-start rounded-lg py-1 text-sm font-bold underline decoration-2 underline-offset-4"
        >
          ← Decks
        </Link>
        <h1 className="text-4xl font-bold tracking-tight">{deck.name}</h1>
        <p className="text-ink-soft text-sm">
          {languageLabel(deck.source_lang)} → {languageLabel(deck.target_lang)}
          {deck.archived ? " · archived" : ""}
        </p>
      </div>

      <nav aria-label="Deck actions" className="flex flex-wrap gap-2">
        <Link href={`/study?deck=${deck.id}`} className={buttonClass("primary")}>
          Study
        </Link>
        <Link href={`/decks/${deck.id}/import`} className={buttonClass("secondary")}>
          Import
        </Link>
        <a href={`/decks/${deck.id}/export`} className={buttonClass("secondary")} download>
          Download CSV
        </a>
        <Link href={`/decks/${deck.id}/members`} className={buttonClass("secondary")}>
          Members
        </Link>
        {isOwner ? (
          <Link href={`/decks/${deck.id}/settings`} className={buttonClass("secondary")}>
            Settings
          </Link>
        ) : null}
      </nav>

      {!deck.archived ? (
        <section className="brutal-card p-4">
          <h2 className="mb-2 text-xl font-bold">Add words</h2>
          <QuickAdd deckId={deck.id} frontLang={deck.source_lang} backLang={deck.target_lang} />
        </section>
      ) : null}

      <section aria-labelledby="cards" className="flex flex-col gap-3">
        <h2 id="cards" className="text-xl font-bold">
          {archived ? "Archived cards" : "Cards"}{" "}
          <span className="text-ink-soft font-normal">({total})</span>
        </h2>

        <form method="get" className="flex gap-2" role="search">
          {tag ? <input type="hidden" name="tag" value={tag} /> : null}
          {archived ? <input type="hidden" name="archived" value="1" /> : null}
          <label htmlFor="q" className="sr-only">
            Search cards
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search word, meaning or tag"
            maxLength={LIMITS.search}
            className={inputClass}
          />
          <button type="submit" className={buttonClass("secondary")}>
            Search
          </button>
        </form>

        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2" aria-label="Filter by tag">
            {tag ? (
              <Link href={href({ tag: undefined })} className={tagClass(false)}>
                All tags ✕
              </Link>
            ) : null}
            {tags.map((t) => (
              <Link
                key={t.tag}
                href={href({ tag: t.tag === tag ? undefined : t.tag })}
                className={tagClass(t.tag === tag)}
                aria-current={t.tag === tag ? "true" : undefined}
              >
                #{t.tag} <span className="opacity-60">{t.card_count}</span>
              </Link>
            ))}
          </div>
        ) : null}

        {cards.length === 0 ? (
          <p className="border-ink text-ink-soft rounded-xl border-[2.5px] border-dashed p-6 text-center font-medium">
            {filtering
              ? "No cards match your search."
              : archived
                ? "No archived cards."
                : "No words yet. Add your first word above, or import a list."}
          </p>
        ) : (
          <ul className="brutal-card divide-ink divide-y-[2.5px] overflow-hidden">
            {cards.map((card) => (
              <li key={card.id} className="flex items-center gap-2 p-3">
                <Link
                  href={`/decks/${deck.id}/cards/${card.id}`}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-1"
                >
                  <span className="truncate font-medium" lang={deck.source_lang}>
                    {card.front}
                  </span>
                  <span className="text-ink-soft truncate text-sm" lang={deck.target_lang}>
                    {card.back}
                    {card.tags.length ? (
                      <span className="text-ink-soft">
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
                    aria-label={`${card.archived ? "Restore" : "Archive"} ${card.front}`}
                  >
                    {card.archived ? "Restore" : "Archive"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 ? (
          <nav aria-label="Pages" className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className={buttonClass("secondary")}>
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-ink-soft text-sm">
              Page {page} / {pageCount}
            </span>
            {page < pageCount ? (
              <Link href={href({ page: page + 1 })} className={buttonClass("secondary")}>
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}

        <Link
          href={href({ archived: archived ? "" : "1" })}
          className={buttonClass("ghost", "self-start text-sm")}
        >
          {archived ? "Back to active cards" : "Show archived cards"}
        </Link>
      </section>
    </PageShell>
  );
}

function tagClass(active: boolean) {
  return [
    "inline-flex min-h-11 items-center gap-1 rounded-full border-[2.5px] border-ink px-3 text-sm font-bold",
    active
      ? "bg-pink text-on-accent shadow-hard-sm"
      : "bg-surface text-ink hover:bg-yellow hover:text-on-accent",
  ].join(" ");
}
