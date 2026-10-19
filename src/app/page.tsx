import Link from "next/link";
import { DeckForm } from "@/components/deck-form";
import { PageShell } from "@/components/page-shell";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { listDeckSummaries } from "@/lib/decks";
import { languageLabel } from "@/lib/languages";

const notices: Record<string, string> = {
  sifre: "Şifren kaydedildi.",
  ayrildin: "Desteden ayrıldın.",
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const [{ profile }, params] = await Promise.all([requireUser(), searchParams]);
  const showArchived = params.arsiv === "1";
  const decks = await listDeckSummaries(showArchived);
  const notice = typeof params.durum === "string" ? notices[params.durum] : undefined;
  const active = decks.filter((d) => !d.archived);
  const archived = decks.filter((d) => d.archived);

  return (
    <PageShell displayName={profile.display_name}>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <h1 className="text-2xl font-semibold tracking-tight">Merhaba, {profile.display_name}</h1>

      <section aria-labelledby="desteler" className="flex flex-col gap-3">
        <h2 id="desteler" className="text-lg font-semibold">
          Destelerin
        </h2>
        {active.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Henüz desten yok. Aşağıdan ilk desteni oluştur, sonra kelime eklemeye başla.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((deck) => (
              <DeckRow key={deck.id} deck={deck} />
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="yeni-deste"
        className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 id="yeni-deste" className="mb-3 text-lg font-semibold">
          Yeni deste
        </h2>
        <DeckForm />
      </section>

      <section aria-label="Arşiv">
        {showArchived ? (
          <>
            <h2 className="mb-2 text-lg font-semibold">Arşivdeki desteler</h2>
            {archived.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">Arşivde deste yok.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {archived.map((deck) => (
                  <DeckRow key={deck.id} deck={deck} />
                ))}
              </ul>
            )}
            <Link href="/" className={buttonClass("ghost", "mt-2 text-sm")}>
              Arşivi gizle
            </Link>
          </>
        ) : (
          <Link href="/?arsiv=1" className={buttonClass("ghost", "text-sm")}>
            Arşivdeki desteleri göster
          </Link>
        )}
      </section>
    </PageShell>
  );
}

function DeckRow({ deck }: { deck: Awaited<ReturnType<typeof listDeckSummaries>>[number] }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <Link
        href={`/decks/${deck.id}`}
        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-lg px-1"
      >
        <span className="truncate font-medium">{deck.name}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {languageLabel(deck.source_lang)} → {languageLabel(deck.target_lang)} · {deck.card_count}{" "}
          kart
          {deck.role === "member" ? " · paylaşılan" : ""}
        </span>
      </Link>
      {!deck.archived && deck.card_count > 0 ? (
        <div className="flex shrink-0 items-center gap-2 text-sm">
          {deck.due_count > 0 ? (
            <span className="rounded-full bg-indigo-100 px-2 py-1 font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
              {deck.due_count} tekrar
            </span>
          ) : null}
          {deck.new_count > 0 ? (
            <span className="rounded-full bg-green-100 px-2 py-1 font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
              {deck.new_count} yeni
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
