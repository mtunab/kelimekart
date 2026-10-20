"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { findExistingFronts, importCards } from "@/app/(app)/decks/actions";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { normalizeFront, parseImport, type ParseResult } from "@/lib/import/parse";
import { LIMITS } from "@/lib/validation/cards";

type Preview = ParseResult & { existing: Set<string> };

export function ImportForm({ deckId }: { deckId: string }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const toImport = useMemo(
    () =>
      preview?.cards.filter(
        (c) => !c.duplicateInInput && !preview.existing.has(normalizeFront(c.front)),
      ) ?? [],
    [preview],
  );

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setMessage({ tone: "error", text: "File is too large (2 MB max)." });
      return;
    }
    setText(await file.text());
    setPreview(null);
    setDone(false);
  }

  function showPreview() {
    setMessage(null);
    setDone(false);
    const parsed = parseImport(text);
    if (parsed.cards.length === 0) {
      setPreview(null);
      setMessage({
        tone: "error",
        text: parsed.errors.length
          ? "No readable lines found. Each line needs a word and a meaning."
          : "Paste some words or choose a file first.",
      });
      return;
    }
    if (parsed.cards.length > LIMITS.importRows) {
      setMessage({ tone: "error", text: `At most ${LIMITS.importRows} lines at a time.` });
      return;
    }
    startTransition(async () => {
      try {
        const existing = await findExistingFronts(
          deckId,
          parsed.cards.map((c) => c.front),
        );
        setPreview({ ...parsed, existing: new Set(existing) });
      } catch {
        setMessage({
          tone: "error",
          text: "Connection problem: couldn't build the preview. Try again.",
        });
      }
    });
  }

  function confirmImport() {
    if (toImport.length === 0) return;
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof importCards>>;
      try {
        result = await importCards(
          deckId,
          toImport.map(({ front, back, example, note, tags }) => ({
            front,
            back,
            example,
            note,
            tags,
          })),
        );
      } catch {
        result = { ok: false, error: "Connection problem: couldn't add the cards. Try again." };
      }
      if (!result.ok) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setDone(true);
      setPreview(null);
      setText("");
      setMessage({
        tone: "success",
        text:
          `${result.inserted} ${result.inserted === 1 ? "card" : "cards"} added.` +
          (result.skipped
            ? ` ${result.skipped} already existed and ${result.skipped === 1 ? "was" : "were"} skipped.`
            : ""),
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {done ? (
        <Link href={`/decks/${deckId}`} className={buttonClass("primary", "self-start")}>
          Back to deck
        </Link>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-text" className="text-sm font-bold">
          Words
        </label>
        <textarea
          id="import-text"
          rows={8}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
          }}
          className={`${inputClass} py-2 font-mono text-sm`}
          placeholder={"apple ; elma\npear ; armut"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className={buttonClass("secondary", "cursor-pointer")}>
          Choose CSV file
          <input
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            className="sr-only"
            onChange={onFile}
          />
        </label>
        <Button onClick={showPreview} disabled={pending}>
          {pending && !preview ? "Checking…" : "Preview"}
        </Button>
      </div>

      {preview ? (
        <section aria-labelledby="preview" className="flex flex-col gap-3">
          <h2 id="preview" className="text-xl font-bold">
            Preview
          </h2>
          <p className="text-ink text-sm">
            <strong>{toImport.length}</strong> new {toImport.length === 1 ? "card" : "cards"} will
            be added.
            {preview.cards.length - toImport.length > 0
              ? ` ${preview.cards.length - toImport.length} duplicate(s) will be skipped.`
              : ""}
            {preview.errors.length ? ` ${preview.errors.length} line(s) couldn't be read.` : ""}
          </p>

          {preview.errors.length ? (
            <ul className="border-ink bg-red text-on-accent rounded-xl border-[2.5px] p-3 text-sm font-medium">
              {preview.errors.slice(0, 20).map((e) => (
                <li key={e.line}>
                  Line {e.line}: {e.message}
                </li>
              ))}
              {preview.errors.length > 20 ? <li>… and {preview.errors.length - 20} more</li> : null}
            </ul>
          ) : null}

          <div className="brutal-card max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-yellow text-on-accent sticky top-0">
                <tr>
                  <th className="p-2">Word</th>
                  <th className="p-2">Meaning</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {preview.cards.slice(0, 300).map((card) => {
                  const exists = preview.existing.has(normalizeFront(card.front));
                  const status = card.duplicateInInput
                    ? "Duplicate in list"
                    : exists
                      ? "Already in deck"
                      : "New";
                  return (
                    <tr key={card.line} className="border-ink border-t-[2.5px]">
                      <td className="p-2">{card.front}</td>
                      <td className="p-2">{card.back}</td>
                      <td className="p-2">
                        <span
                          className={`border-ink text-on-accent rounded-full border-2 px-2 py-0.5 text-xs font-bold ${status === "New" ? "bg-teal" : "bg-yellow"}`}
                        >
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.cards.length > 300 ? (
              <p className="text-ink-soft p-2 text-sm">Showing the first 300 lines.</p>
            ) : null}
          </div>

          <Button
            onClick={confirmImport}
            disabled={pending || toImport.length === 0}
            className="self-start"
          >
            {pending
              ? "Adding…"
              : `Add ${toImport.length} ${toImport.length === 1 ? "card" : "cards"}`}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
