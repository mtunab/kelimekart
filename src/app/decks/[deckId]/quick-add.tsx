"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { quickAddCard } from "@/app/decks/actions";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";

type Status = { tone: "ok" | "error" | "info"; text: string } | null;

/**
 * Hızlı ekleme: ön + arka yaz, Enter → alanlar HEMEN boşalır, imleç öne döner,
 * kayıt arka planda yapılır. Art arda çok kelime girmek ana kullanım olduğu için
 * hiçbir şey kullanıcıyı bekletmez; sonuç ("eklendi" / "zaten var") altta görünür.
 */
export function QuickAdd({
  deckId,
  frontLang,
  backLang,
}: {
  deckId: string;
  frontLang: string;
  backLang: string;
}) {
  const router = useRouter();
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [inFlight, setInFlight] = useState(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleRefresh() {
    // Liste her kelimede değil, yazma durunca bir kez yenilenir.
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => router.refresh(), 800);
  }

  async function save(front: string, back: string) {
    setInFlight((n) => n + 1);
    try {
      const result = await quickAddCard(deckId, { front, back });
      if (result.ok) {
        setStatus({ tone: "ok", text: `Eklendi: ${result.front}` });
        scheduleRefresh();
      } else {
        setStatus({ tone: "error", text: result.error });
      }
    } catch {
      setStatus({
        tone: "error",
        text: `"${front.trim()}" kaydedilemedi (bağlantı sorunu). Tekrar dene.`,
      });
    } finally {
      setInFlight((n) => n - 1);
    }
  }

  function submit(event?: React.FormEvent) {
    event?.preventDefault();
    const front = frontRef.current?.value ?? "";
    const back = backRef.current?.value ?? "";
    if (!front.trim()) return frontRef.current?.focus();
    if (!back.trim()) return backRef.current?.focus();
    if (frontRef.current) frontRef.current.value = "";
    if (backRef.current) backRef.current.value = "";
    frontRef.current?.focus();
    setStatus({ tone: "info", text: `Kaydediliyor: ${front.trim()}` });
    void save(front, back);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2" aria-label="Hızlı kelime ekle">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="qa-front"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Kelime
          </label>
          <input
            id="qa-front"
            ref={frontRef}
            lang={frontLang}
            className={inputClass}
            autoComplete="off"
            autoCapitalize="none"
            maxLength={200}
            enterKeyHint="next"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              // Anlam boşsa önce anlama geç; doluysa kaydet.
              if (!backRef.current?.value.trim()) backRef.current?.focus();
              else submit();
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="qa-back" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Anlamı
          </label>
          <input
            id="qa-back"
            ref={backRef}
            lang={backLang}
            className={inputClass}
            autoComplete="off"
            maxLength={500}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              submit();
            }}
          />
        </div>
        <Button type="submit" className="self-end">
          Ekle
        </Button>
      </div>
      <p
        role="status"
        aria-live="polite"
        aria-busy={inFlight > 0}
        className={`min-h-5 text-sm ${
          status?.tone === "error"
            ? "text-red-700 dark:text-red-300"
            : status?.tone === "info"
              ? "text-zinc-500"
              : "text-green-700 dark:text-green-300"
        }`}
      >
        {status?.text ?? ""}
      </p>
    </form>
  );
}
