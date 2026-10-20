import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { requireDeck } from "@/lib/decks";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Import · KelimeKart" };

export default async function ImportPage({ params }: PageProps<"/decks/[deckId]/import">) {
  const { deckId } = await params;
  const { deck } = await requireDeck(deckId);

  return (
    <PageShell>
      <Link
        href={`/decks/${deck.id}`}
        className="self-start rounded-lg py-1 text-sm font-bold underline decoration-2 underline-offset-4"
      >
        ← {deck.name}
      </Link>
      <h1 className="text-4xl font-bold tracking-tight">Bulk import</h1>
      <div className="text-ink-soft text-sm">
        <p>Write one word per line, or choose a CSV file. Example:</p>
        <pre className="border-ink bg-surface text-ink mt-2 overflow-x-auto rounded-lg border-[2.5px] p-3 font-mono">
          {"apple ; elma\nto borrow ; ödünç almak ; Can I borrow it? ; ; verb|A2"}
        </pre>
        <p className="mt-2">
          Columns: word ; meaning ; example sentence ; note ; tags. Only the first two are required.
          You can also copy and paste from Excel.
        </p>
      </div>
      <ImportForm deckId={deck.id} />
    </PageShell>
  );
}
