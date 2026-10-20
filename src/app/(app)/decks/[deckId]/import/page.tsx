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
        className="self-start rounded-md py-1 text-sm text-indigo-700 dark:text-indigo-300"
      >
        ← {deck.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Bulk import</h1>
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>Write one word per line, or choose a CSV file. Example:</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
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
