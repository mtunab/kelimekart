"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { buttonClass } from "@/components/ui/button";
import {
  formatInterval,
  fromFsrsCard,
  GRADE_LABELS,
  GRADES,
  previewDueDates,
  review,
  toFsrsCard,
  type Grade,
  type ProgressFields,
} from "@/lib/srs";
import { sessionSummary, submitReview, undoReview } from "./actions";
import { canSpeak, speak } from "./speech";

export type QueueItem = {
  cardId: string;
  deckId: string;
  front: string;
  back: string;
  example: string | null;
  note: string | null;
  sourceLang: string;
  targetLang: string;
  isNew: boolean;
  progress: ProgressFields | null;
};

type HistoryEntry = {
  item: QueueItem;
  rating: Grade;
  status: "pending" | "saved" | "failed" | "undone";
  logId: number | null;
  /** Bu cevaptan sonra kart aynı oturumda tekrar gösterilecekse kuyruğa eklenen kopya. */
  requeued: boolean;
};

/** Öğrenme adımındaki kart bu süre içinde vadesi gelecekse oturumda tekrar gösterilir. */
const LEARN_AHEAD_MS = 20 * 60_000;
const SWIPE_THRESHOLD = 90;

const GRADE_STYLES: Record<Grade, string> = {
  1: "bg-red-600 hover:bg-red-700 text-white",
  2: "bg-amber-500 hover:bg-amber-600 text-white",
  3: "bg-green-600 hover:bg-green-700 text-white",
  4: "bg-sky-600 hover:bg-sky-700 text-white",
};

/** Ağ hatasında aynı olay kimliğiyle yeniden dener (sunucu tarafı idempotent). */
async function submitWithRetry(input: { cardId: string; rating: Grade; clientEventId: string }) {
  let last: Awaited<ReturnType<typeof submitReview>> = { ok: false, error: "Cevap kaydedilemedi." };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await submitReview(input);
      if (last.ok) return last;
    } catch {
      last = { ok: false, error: "Bağlantı sorunu." };
    }
    await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
  }
  return last;
}

export function StudySession({
  initialQueue,
  reviewsToday,
  dailyGoal,
  backHref,
}: {
  initialQueue: QueueItem[];
  reviewsToday: number;
  dailyGoal: number;
  backHref: string;
}) {
  const [queue, setQueue] = useState(initialQueue);
  const [flipped, setFlipped] = useState(false);
  // Geçmiş hem ekran için state'te hem de sıralı kayıt zincirinin güncel okuması için ref'te tutulur.
  const historyRef = useRef<HistoryEntry[]>([]);
  const [history, setHistoryState] = useState<HistoryEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [summary, setSummary] = useState<{ tomorrowDue: number; streak: number } | null>(null);
  // Sunucuda false, tarayıcıda gerçek değer (hidrasyon uyumsuzluğu olmadan).
  const speechAvailable = useSyncExternalStore(noopSubscribe, canSpeak, () => false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pointer = useRef<{ x: number; moved: boolean } | null>(null);

  const current = queue[0];
  const answered = history.filter((h) => h.status !== "undone" && h.status !== "failed");
  const correct = answered.filter((h) => h.rating >= 2).length;
  const doneToday = reviewsToday + answered.length;
  const newLeft = queue.filter((q) => q.isNew).length;
  const reviewLeft = queue.length - newLeft;
  const pendingCount = history.filter((h) => h.status === "pending").length;
  const finished = !current;

  const previews = useMemo(() => {
    if (!current || !flipped) return null;
    const now = new Date();
    const dues = previewDueDates(toFsrsCard(current.progress, now), now);
    return Object.fromEntries(GRADES.map((g) => [g, formatInterval(now, dues[g])])) as Record<
      Grade,
      string
    >;
  }, [current, flipped]);

  const pushEntry = useCallback((entry: HistoryEntry) => {
    historyRef.current = [...historyRef.current, entry];
    setHistoryState(historyRef.current);
    return historyRef.current.length - 1;
  }, []);

  const updateEntry = useCallback((entryIndex: number, patch: Partial<HistoryEntry>) => {
    historyRef.current = historyRef.current.map((e, i) =>
      i === entryIndex ? { ...e, ...patch } : e,
    );
    setHistoryState(historyRef.current);
  }, []);

  const answer = useCallback(
    (rating: Grade) => {
      if (!current || !flipped) return;
      const item = current;
      const now = new Date();
      const next = review(toFsrsCard(item.progress, now), rating, now);
      const requeue = next.due.getTime() - now.getTime() <= LEARN_AHEAD_MS;
      const optimistic: QueueItem = { ...item, isNew: false, progress: fromFsrsCard(next) };

      setQueue((q) => (requeue ? [...q.slice(1), optimistic] : q.slice(1)));
      setFlipped(false);
      setDragX(0);
      setNotice(null);

      const entryIndex = pushEntry({
        item,
        rating,
        status: "pending",
        logId: null,
        requeued: requeue,
      });

      const clientEventId = crypto.randomUUID();
      // Cevaplar sırayla gönderilir: aynı kart tekrar cevaplanırsa sıra karışmasın.
      chain.current = chain.current.then(async () => {
        const result = await submitWithRetry({ cardId: item.cardId, rating, clientEventId });
        if (result.ok) {
          updateEntry(entryIndex, { status: "saved", logId: result.logId });
          if (requeue && result.progress) {
            const serverProgress = result.progress;
            setQueue((q) =>
              q.map((x) => (x.cardId === item.cardId ? { ...x, progress: serverProgress } : x)),
            );
          }
        } else {
          updateEntry(entryIndex, { status: "failed" });
          // Kart geri gelir: yeniden eklenen kopyayı kaldır, kartı öne koy.
          setQueue((q) => [item, ...q.filter((x) => x.cardId !== item.cardId)]);
          setFlipped(false);
          setNotice(`"${item.front}" için cevap kaydedilemedi; kart tekrar gösteriliyor.`);
        }
      });
    },
    [current, flipped, pushEntry, updateEntry],
  );

  const undo = useCallback(() => {
    const index = historyRef.current.findLastIndex(
      (h) => h.status === "pending" || h.status === "saved",
    );
    if (index < 0) return;
    // Bu cevabın kaydı bitmediyse zincir onu bekler; sonra güncel kayıt numarası okunur.
    chain.current = chain.current.then(async () => {
      const entry = historyRef.current[index];
      if (!entry || entry.status !== "saved" || entry.logId === null) {
        setNotice("Geri alınamadı: cevap kaydedilmemişti.");
        return;
      }
      const result = await undoReview({ logId: entry.logId });
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      updateEntry(index, { status: "undone" });
      setQueue((q) => [entry.item, ...q.filter((x) => x.cardId !== entry.item.cardId)]);
      setFlipped(false);
      setNotice(`Geri alındı: ${entry.item.front}`);
    });
  }, [updateEntry]);

  // Klavye: Boşluk = çevir, 1-4 = puan, Z = geri al.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select")) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " " || event.code === "Space") {
        if (!current) return;
        event.preventDefault();
        setFlipped(true);
      } else if (["1", "2", "3", "4"].includes(event.key)) {
        if (!flipped) return;
        event.preventDefault();
        answer(Number(event.key) as Grade);
      } else if (event.key === "z" || event.key === "Z") {
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, undo, current, flipped]);

  // Oturum bitince özet (yarının yükü) sunucudan alınır.
  useEffect(() => {
    if (!finished || pendingCount > 0 || summary) return;
    let cancelled = false;
    chain.current
      .then(() => sessionSummary())
      .then((s) => {
        if (!cancelled) setSummary({ tomorrowDue: s.tomorrowDue, streak: s.streak });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [finished, pendingCount, summary]);

  const goalPercent = Math.min(100, Math.round((doneToday / Math.max(1, dailyGoal)) * 100));
  const lastUndoable = history.some((h) => h.status === "pending" || h.status === "saved");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            Günlük hedef: {doneToday} / {dailyGoal}
          </span>
          {!finished ? (
            <span>
              <span className="text-indigo-700 dark:text-indigo-300">{reviewLeft} tekrar</span> ·{" "}
              <span className="text-green-700 dark:text-green-300">{newLeft} yeni</span>
            </span>
          ) : null}
        </div>
        <div
          role="progressbar"
          aria-label="Günlük hedef"
          aria-valuemin={0}
          aria-valuemax={dailyGoal}
          aria-valuenow={Math.min(doneToday, dailyGoal)}
          className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div
            className="h-full bg-indigo-600 transition-all"
            style={{ width: `${goalPercent}%` }}
          />
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm text-amber-700 dark:text-amber-300"
      >
        {notice ?? ""}
      </p>

      {current ? (
        <>
          <div
            data-testid="study-card"
            className="relative flex min-h-72 cursor-pointer touch-pan-y flex-col items-center justify-center gap-3 rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm select-none dark:border-zinc-800 dark:bg-zinc-900"
            style={{
              transform: dragX ? `translateX(${dragX}px) rotate(${dragX / 25}deg)` : undefined,
              transition: dragX ? "none" : "transform 150ms",
            }}
            onPointerDown={(e) => {
              pointer.current = { x: e.clientX, moved: false };
            }}
            onPointerMove={(e) => {
              if (!pointer.current || !flipped) return;
              const dx = e.clientX - pointer.current.x;
              if (Math.abs(dx) > 8) pointer.current.moved = true;
              setDragX(dx);
            }}
            onPointerUp={() => {
              const p = pointer.current;
              pointer.current = null;
              if (flipped && dragX > SWIPE_THRESHOLD) return answer(3);
              if (flipped && dragX < -SWIPE_THRESHOLD) return answer(1);
              setDragX(0);
              if (!p?.moved) setFlipped(true);
            }}
            onPointerCancel={() => {
              pointer.current = null;
              setDragX(0);
            }}
          >
            {current.isNew ? (
              <span className="absolute top-3 left-3 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
                yeni
              </span>
            ) : null}
            {dragX !== 0 ? (
              <span
                aria-hidden
                className={`absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-semibold ${dragX > 0 ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
              >
                {dragX > 0 ? "İyi" : "Tekrar"}
              </span>
            ) : null}
            <p lang={current.sourceLang} className="text-3xl font-semibold break-words">
              {current.front}
            </p>
            {flipped ? (
              <>
                <hr className="w-16 border-zinc-200 dark:border-zinc-700" />
                <p
                  lang={current.targetLang}
                  className="text-2xl break-words text-zinc-800 dark:text-zinc-100"
                >
                  {current.back}
                </p>
                {current.example ? (
                  <p
                    lang={current.sourceLang}
                    className="text-base text-zinc-600 italic dark:text-zinc-400"
                  >
                    {current.example}
                  </p>
                ) : null}
                {current.note ? (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{current.note}</p>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="flex justify-center gap-2">
            {speechAvailable ? (
              <button
                type="button"
                className={buttonClass("secondary", "text-sm")}
                onClick={() => speak(current.front, current.sourceLang)}
                aria-label={`"${current.front}" telaffuzunu dinle`}
              >
                🔊 Dinle
              </button>
            ) : null}
            <button
              type="button"
              className={buttonClass("ghost", "text-sm")}
              onClick={undo}
              disabled={!lastUndoable}
            >
              ↶ Geri al
            </button>
          </div>

          {flipped ? (
            <div
              className="grid grid-cols-4 gap-2"
              role="group"
              aria-label="Ne kadar iyi hatırladın?"
            >
              {GRADES.map((grade) => (
                <button
                  key={grade}
                  type="button"
                  onClick={() => answer(grade)}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl px-1 py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${GRADE_STYLES[grade]}`}
                >
                  <span>{GRADE_LABELS[grade]}</span>
                  <span className="text-xs opacity-90">{previews?.[grade]}</span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className={buttonClass("primary", "min-h-14 w-full")}
              onClick={() => setFlipped(true)}
            >
              Çevir
            </button>
          )}
          <p className="hidden text-center text-xs text-zinc-500 sm:block">
            Kısayollar: Boşluk = çevir · 1–4 = puan · Z = geri al
          </p>
          <p className="text-center text-xs text-zinc-500 sm:hidden">
            Çevirdikten sonra kartı sağa kaydır = İyi, sola = Tekrar
          </p>
        </>
      ) : (
        <section
          aria-labelledby="ozet"
          className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 p-6 text-center dark:border-zinc-800"
        >
          <h1 id="ozet" className="text-2xl font-semibold">
            {answered.length ? "Bugünlük bu kadar! 🎉" : "Şu an çalışılacak kart yok"}
          </h1>
          {answered.length ? (
            <dl className="grid w-full grid-cols-3 gap-2">
              <Stat label="Kart" value={String(answered.length)} />
              <Stat
                label="Doğruluk"
                value={`%${Math.round((correct / Math.max(1, answered.length)) * 100)}`}
              />
              <Stat label="Yarın" value={summary ? String(summary.tomorrowDue) : "…"} />
            </dl>
          ) : (
            <p className="text-zinc-600 dark:text-zinc-400">
              Vadesi gelen kart yok ve bugünün yeni kart limiti doldu ya da destede yeni kelime yok.
            </p>
          )}
          {summary && summary.streak > 0 ? (
            <p className="text-zinc-700 dark:text-zinc-300">🔥 {summary.streak} günlük seri</p>
          ) : null}
          {pendingCount > 0 ? (
            <p className="text-sm text-zinc-500">Cevaplar kaydediliyor…</p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            {lastUndoable ? (
              <button type="button" className={buttonClass("secondary")} onClick={undo}>
                ↶ Son cevabı geri al
              </button>
            ) : null}
            <Link href={backHref} className={buttonClass("primary")}>
              Tamam
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function noopSubscribe() {
  return () => undefined;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-900">
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}
