"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { findExistingFronts, importCards } from "@/app/decks/actions";
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
      setMessage({ tone: "error", text: "Dosya çok büyük (en fazla 2 MB)." });
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
          ? "Okunabilir satır bulunamadı. Her satırda kelime ve anlam olmalı."
          : "Önce kelimeleri yapıştır veya bir dosya seç.",
      });
      return;
    }
    if (parsed.cards.length > LIMITS.importRows) {
      setMessage({ tone: "error", text: `Tek seferde en fazla ${LIMITS.importRows} satır.` });
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
        setMessage({ tone: "error", text: "Bağlantı sorunu: önizleme yapılamadı, tekrar dene." });
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
        result = { ok: false, error: "Bağlantı sorunu: kartlar eklenemedi, tekrar dene." };
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
          `${result.inserted} kart eklendi.` +
          (result.skipped ? ` ${result.skipped} kart zaten vardı, atlandı.` : ""),
      });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {done ? (
        <Link href={`/decks/${deckId}`} className={buttonClass("primary", "self-start")}>
          Desteye dön
        </Link>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="import-text"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Kelimeler
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
          CSV dosyası seç
          <input
            type="file"
            accept=".csv,.txt,.tsv,text/csv,text/plain"
            className="sr-only"
            onChange={onFile}
          />
        </label>
        <Button onClick={showPreview} disabled={pending}>
          {pending && !preview ? "Kontrol ediliyor…" : "Önizle"}
        </Button>
      </div>

      {preview ? (
        <section aria-labelledby="onizleme" className="flex flex-col gap-3">
          <h2 id="onizleme" className="text-lg font-semibold">
            Önizleme
          </h2>
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <strong>{toImport.length}</strong> yeni kart eklenecek.
            {preview.cards.length - toImport.length > 0
              ? ` ${preview.cards.length - toImport.length} kart tekrar ettiği için atlanacak.`
              : ""}
            {preview.errors.length ? ` ${preview.errors.length} satır okunamadı.` : ""}
          </p>

          {preview.errors.length ? (
            <ul className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {preview.errors.slice(0, 20).map((e) => (
                <li key={e.line}>
                  Satır {e.line}: {e.message}
                </li>
              ))}
              {preview.errors.length > 20 ? (
                <li>… ve {preview.errors.length - 20} satır daha</li>
              ) : null}
            </ul>
          ) : null}

          <div className="max-h-96 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-zinc-100 dark:bg-zinc-900">
                <tr>
                  <th className="p-2">Kelime</th>
                  <th className="p-2">Anlam</th>
                  <th className="p-2">Durum</th>
                </tr>
              </thead>
              <tbody>
                {preview.cards.slice(0, 300).map((card) => {
                  const exists = preview.existing.has(normalizeFront(card.front));
                  const status = card.duplicateInInput
                    ? "Listede tekrar"
                    : exists
                      ? "Destede zaten var"
                      : "Yeni";
                  return (
                    <tr key={card.line} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="p-2">{card.front}</td>
                      <td className="p-2">{card.back}</td>
                      <td
                        className={`p-2 ${status === "Yeni" ? "text-green-700 dark:text-green-300" : "text-amber-700 dark:text-amber-300"}`}
                      >
                        {status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {preview.cards.length > 300 ? (
              <p className="p-2 text-sm text-zinc-500">İlk 300 satır gösteriliyor.</p>
            ) : null}
          </div>

          <Button
            onClick={confirmImport}
            disabled={pending || toImport.length === 0}
            className="self-start"
          >
            {pending ? "Ekleniyor…" : `${toImport.length} kartı ekle`}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
