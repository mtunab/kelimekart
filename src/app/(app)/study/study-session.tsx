"use client";

import {
  AnimatePresence,
  m,
  useIsPresent,
  useMotionValue,
  useTransform,
  type Variants,
} from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ProgressBar } from "@/components/motion/progress-bar";
import { buttonClass } from "@/components/ui/button";
import {
  formatInterval,
  fromFsrsCard,
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

/** Kartın çıkış yönü: Again sola, Hard/Good sağa, Easy yukarı. */
type ExitDir = { x: number; y: number };

/** Öğrenme adımındaki kart bu süre içinde vadesi gelecekse oturumda tekrar gösterilir. */
const LEARN_AHEAD_MS = 20 * 60_000;
const SWIPE_DISTANCE = 100;
const SWIPE_VELOCITY = 600;

const EXIT_BY_GRADE: Record<Grade, ExitDir> = {
  1: { x: -1, y: 0 },
  2: { x: 1, y: 0 },
  3: { x: 1, y: 0 },
  4: { x: 0, y: -1 },
};

const cardVariants: Variants = {
  enter: { opacity: 0, scale: 0.92, y: 24 },
  center: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 28 },
  },
  exit: (dir: ExitDir) => ({
    x: dir.x * 460,
    y: dir.y * 380,
    opacity: 0,
    transition: { duration: 0.28, ease: "easeIn" },
  }),
};

/** Ağ hatasında aynı olay kimliğiyle yeniden dener (sunucu tarafı idempotent). */
async function submitWithRetry(input: { cardId: string; rating: Grade; clientEventId: string }) {
  let last: Awaited<ReturnType<typeof submitReview>> = {
    ok: false,
    error: "Couldn't save your answer.",
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      last = await submitReview(input);
      if (last.ok) return last;
    } catch {
      last = { ok: false, error: "Connection problem." };
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
  // Her gösterim için ayrı anahtar: aynı kart tekrar gelse de giriş/çıkış animasyonu çalışsın.
  const [turn, setTurn] = useState(0);
  const [exitDir, setExitDir] = useState<ExitDir>({ x: 1, y: 0 });
  // Geçmiş hem ekran için state'te hem de sıralı kayıt zincirinin güncel okuması için ref'te tutulur.
  const historyRef = useRef<HistoryEntry[]>([]);
  const [history, setHistoryState] = useState<HistoryEntry[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ tomorrowDue: number; streak: number } | null>(null);
  // Sunucuda false, tarayıcıda gerçek değer (hidrasyon uyumsuzluğu olmadan).
  const speechAvailable = useSyncExternalStore(noopSubscribe, canSpeak, () => false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

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

      setExitDir(EXIT_BY_GRADE[rating]);
      setQueue((q) => (requeue ? [...q.slice(1), optimistic] : q.slice(1)));
      setTurn((t) => t + 1);
      setFlipped(false);
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
          setTurn((t) => t + 1);
          setFlipped(false);
          setNotice(`Couldn't save your answer for "${item.front}" — showing it again.`);
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
        setNotice("Couldn't undo: the answer wasn't saved.");
        return;
      }
      const result = await undoReview({ logId: entry.logId });
      if (!result.ok) {
        setNotice(result.error);
        return;
      }
      updateEntry(index, { status: "undone" });
      setExitDir({ x: 0, y: 1 });
      setQueue((q) => [entry.item, ...q.filter((x) => x.cardId !== entry.item.cardId)]);
      setTurn((t) => t + 1);
      setFlipped(false);
      setNotice(`Undone: ${entry.item.front}`);
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

  const lastUndoable = history.some((h) => h.status === "pending" || h.status === "saved");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span>
            Daily goal: {doneToday} / {dailyGoal}
          </span>
          {!finished ? (
            <span>
              <span className="text-indigo-700 dark:text-indigo-300">{reviewLeft} due</span> ·{" "}
              <span className="text-green-700 dark:text-green-300">{newLeft} new</span>
            </span>
          ) : null}
        </div>
        <ProgressBar value={doneToday} max={dailyGoal} label="Daily goal" />
      </div>

      <div role="status" aria-live="polite" className="min-h-5 text-sm">
        <AnimatePresence mode="wait" initial={false}>
          {notice ? (
            <m.p
              key={notice}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-amber-700 dark:text-amber-300"
            >
              {notice}
            </m.p>
          ) : null}
        </AnimatePresence>
      </div>

      {current ? (
        <>
          <div className="relative">
            <AnimatePresence mode="popLayout" custom={exitDir} initial={false}>
              <FlipCard
                key={`${current.cardId}-${turn}`}
                item={current}
                flipped={flipped}
                intervals={previews}
                onFlip={() => setFlipped(true)}
                onSwipe={answer}
              />
            </AnimatePresence>
          </div>

          <div className="flex justify-center gap-2">
            {speechAvailable ? (
              <button
                type="button"
                className={buttonClass("secondary", "text-sm")}
                onClick={() => speak(current.front, current.sourceLang)}
                aria-label={`Listen to "${current.front}"`}
              >
                🔊 Listen
              </button>
            ) : null}
            <button
              type="button"
              className={buttonClass("ghost", "text-sm")}
              onClick={undo}
              disabled={!lastUndoable}
            >
              ↶ Undo
            </button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {flipped ? (
              // Puan düğmeleri yok (Tuna'nın isteği): telefonda kaydır, klavyede 1-4.
              <m.p
                key="swipe-hint"
                className="flex min-h-14 items-center justify-between rounded-2xl border border-dashed border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                <span className="text-red-700 dark:text-red-300">← Again · {previews?.[1]}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">swipe</span>
                <span className="text-green-700 dark:text-green-300">Good · {previews?.[3]} →</span>
              </m.p>
            ) : (
              <m.button
                key="show"
                type="button"
                className={buttonClass("primary", "min-h-14 w-full")}
                onClick={() => setFlipped(true)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                whileTap={{ scale: 0.97 }}
              >
                Show answer
              </m.button>
            )}
          </AnimatePresence>
          <p className="hidden text-center text-xs text-zinc-500 sm:block dark:text-zinc-400">
            Keys: Space = flip · 1 Again · 2 Hard · 3 Good · 4 Easy · Z = undo
          </p>
          <p className="text-center text-xs text-zinc-500 sm:hidden dark:text-zinc-400">
            Tap to flip, then swipe right = Good, left = Again
          </p>
        </>
      ) : (
        <m.section
          aria-labelledby="summary"
          className="flex flex-col items-center gap-4 rounded-3xl border border-zinc-200 p-6 text-center dark:border-zinc-800"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
        >
          {answered.length ? (
            <m.p
              aria-hidden="true"
              className="text-5xl"
              animate={{ y: [0, -14, 0], rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.9, delay: 0.15 }}
            >
              🎉
            </m.p>
          ) : null}
          <h1 id="summary" className="text-2xl font-semibold">
            {answered.length ? "Session complete!" : "Nothing to study right now"}
          </h1>
          {answered.length ? (
            <dl className="grid w-full grid-cols-3 gap-2">
              <Stat index={0} label="Cards" value={String(answered.length)} />
              <Stat
                index={1}
                label="Accuracy"
                value={`${Math.round((correct / Math.max(1, answered.length)) * 100)}%`}
              />
              <Stat
                index={2}
                label="Tomorrow"
                value={summary ? String(summary.tomorrowDue) : "…"}
              />
            </dl>
          ) : (
            <p className="text-zinc-600 dark:text-zinc-400">
              No cards are due, and today&apos;s new-card limit is reached or there are no new
              words.
            </p>
          )}
          {summary && summary.streak > 0 ? (
            <m.p
              className="text-zinc-700 dark:text-zinc-300"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              🔥 {summary.streak}-day streak
            </m.p>
          ) : null}
          {pendingCount > 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Saving your answers…</p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            {lastUndoable ? (
              <button type="button" className={buttonClass("secondary")} onClick={undo}>
                ↶ Undo last answer
              </button>
            ) : null}
            <Link href={backHref} className={buttonClass("primary")}>
              Done
            </Link>
          </div>
        </m.section>
      )}
    </div>
  );
}

/**
 * Çevrilebilen kart. Ön yüz: kelime. Arka yüz: kelime + anlam + örnek + not.
 * Dokun/boşluk = 3B çevir. Çevrildikten sonra sürüklenebilir: sağa = İyi, sola = Tekrar.
 * Damgalarda kartın bir sonraki gösterim aralığı yazar.
 */
function FlipCard({
  item,
  flipped,
  intervals,
  onFlip,
  onSwipe,
}: {
  item: QueueItem;
  flipped: boolean;
  intervals: Record<Grade, string> | null;
  onFlip: () => void;
  onSwipe: (grade: Grade) => void;
}) {
  // Çıkış animasyonu sürerken kart hâlâ DOM'da: test ve ekran okuyucu yeni kartı görsün.
  const isPresent = useIsPresent();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);
  const againOpacity = useTransform(x, [-110, -25], [1, 0]);
  const goodOpacity = useTransform(x, [25, 110], [0, 1]);

  return (
    <m.div
      data-testid={isPresent ? "study-card" : undefined}
      data-flipped={flipped}
      aria-hidden={isPresent ? undefined : true}
      className={`relative w-full touch-pan-y select-none [perspective:1200px] ${
        flipped ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      }`}
      style={{ x, rotate }}
      variants={cardVariants}
      initial="enter"
      animate="center"
      exit="exit"
      drag={flipped && isPresent ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.7}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) onSwipe(3);
        else if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) onSwipe(1);
      }}
      onTap={() => {
        if (!flipped) onFlip();
      }}
    >
      {/* Damgalar kaydırma yönünün ters köşesinde: kart kayarken ekran dışına çıkmasınlar. */}
      <m.span
        aria-hidden="true"
        style={{ opacity: againOpacity }}
        className="pointer-events-none absolute top-4 right-4 z-10 rotate-12 rounded-lg border-2 border-red-600 px-2 py-0.5 text-sm font-bold text-red-600"
      >
        AGAIN{intervals ? <span className="ml-1 font-medium">{intervals[1]}</span> : null}
      </m.span>
      <m.span
        aria-hidden="true"
        style={{ opacity: goodOpacity }}
        className="pointer-events-none absolute top-4 left-4 z-10 -rotate-12 rounded-lg border-2 border-green-600 px-2 py-0.5 text-sm font-bold text-green-600"
      >
        GOOD{intervals ? <span className="ml-1 font-medium">{intervals[3]}</span> : null}
      </m.span>

      <m.div
        className="grid [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 24 }}
      >
        <Face hidden={flipped}>
          {item.isNew ? (
            <span className="absolute top-3 left-3 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
              new
            </span>
          ) : null}
          <p lang={item.sourceLang} className="text-3xl font-semibold break-words">
            {item.front}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Tap to reveal</p>
        </Face>
        <Face back hidden={!flipped}>
          <p
            lang={item.sourceLang}
            className="text-lg font-medium text-zinc-500 dark:text-zinc-400"
          >
            {item.front}
          </p>
          <hr className="w-16 border-zinc-200 dark:border-zinc-700" />
          <p lang={item.targetLang} className="text-2xl font-semibold break-words">
            {item.back}
          </p>
          {item.example ? (
            <p lang={item.sourceLang} className="text-base text-zinc-600 italic dark:text-zinc-400">
              {item.example}
            </p>
          ) : null}
          {item.note ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.note}</p>
          ) : null}
        </Face>
      </m.div>
    </m.div>
  );
}

/** Kartın bir yüzü. İki yüz aynı ızgara hücresinde üst üste; arka yüz 180° döndürülmüş. */
function Face({
  children,
  back = false,
  hidden,
}: {
  children: React.ReactNode;
  back?: boolean;
  hidden: boolean;
}) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className="relative col-start-1 row-start-1 flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function noopSubscribe() {
  return () => undefined;
}

function Stat({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <m.div
      className="rounded-xl bg-zinc-100 p-3 dark:bg-zinc-900"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.08 }}
    >
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </m.div>
  );
}
