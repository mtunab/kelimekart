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
import { FlameIcon, SpeakerIcon, UndoIcon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";
import type { Grade } from "@/lib/srs";
import { countGap, MIN_GAP, pickNext, type QueueSlot } from "@/lib/study-queue";
import { extraCards, sessionSummary, submitReview, undoReview } from "./actions";
import type { QueueItem } from "./queue-item";
import { canSpeak, speak } from "./speech";

/** Oturumdaki kart: dönüş zamanı ve "araya girecek kart" sayacıyla. */
type Slot = QueueItem & QueueSlot;

/** Öğrenme adımındaki kart (ilk cevapta) hemen gösterilebilir; sonra gerçek zamanını bekler. */
function toSlot(item: QueueItem): Slot {
  const due = item.progress ? Date.parse(item.progress.due) : 0;
  return { ...item, availableAt: Number.isFinite(due) ? due : 0, gapLeft: 0 };
}

/** Günlük hedefe ulaşılmadan liste biterse bir seferde istenen ek kart sayısı. */
const EXTRA_BATCH = 5;

type HistoryEntry = {
  item: Slot;
  rating: Grade;
  status: "pending" | "saved" | "failed" | "undone";
  logId: number | null;
  /** Bu cevaptan sonra kart aynı oturumda tekrar gösterilecekse kuyruğa eklenen kopya. */
  requeued: boolean;
};

/** Kartın çıkış yönü: Again sola, Hard/Good sağa, Easy yukarı. */
type ExitDir = { x: number; y: number };

/** Öğrenme adımındaki kart bu süre içinde vadesi gelecekse oturumda (zamanı gelince) tekrar gösterilir. */
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

type Srs = typeof import("@/lib/srs");
let srsModule: Promise<Srs> | null = null;

/**
 * Tekrar hesabı (ts-fsrs) ilk yükte inmez: sayfa açılınca arka planda yüklenir, kart
 * çevrilene kadar hazır olur. Böylece çalışma ekranı daha hızlı açılır.
 */
function loadSrs() {
  return (srsModule ??= import("@/lib/srs"));
}

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
  deckId,
  serverNow,
}: {
  initialQueue: QueueItem[];
  reviewsToday: number;
  dailyGoal: number;
  backHref: string;
  deckId: string | null;
  serverNow: number;
}) {
  // Oturum başındaki sayı bir kez alınır: sayfa sunucudan yenilense de (ör. giriş anahtarı
  // tazelenince) bu oturumdaki cevaplar iki kez sayılmaz.
  const [startReviews] = useState(reviewsToday);
  const [queue, setQueue] = useState<Slot[]>(() => initialQueue.map(toSlot));
  // Kart seçimi bu saate göre yapılır; cevapta ve beklerken saniyede bir güncellenir.
  const [now, setNow] = useState(serverNow);
  const [lastCardId, setLastCardId] = useState<string | null>(null);
  // Ek kart: istek sürüyor mu, kaynak tükendi mi?
  const fetchingExtra = useRef(false);
  const [extraExhausted, setExtraExhausted] = useState(false);
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
  const [srs, setSrs] = useState<Srs | null>(null);
  const srsRef = useRef<Srs | null>(null);
  // Hesap modülü gelmeden verilen cevap kaybolmasın: modül gelince işlenir.
  const queuedRating = useRef<Grade | null>(null);
  const answerRef = useRef<(rating: Grade) => void>(() => undefined);

  const pick = pickNext(queue, now, lastCardId);
  const current = pick.kind === "card" ? queue[pick.index] : undefined;
  const answered = history.filter((h) => h.status !== "undone" && h.status !== "failed");
  const correct = answered.filter((h) => h.rating >= 2).length;
  const doneToday = startReviews + answered.length;
  const newLeft = queue.filter((q) => q.isNew).length;
  const reviewLeft = queue.length - newLeft;
  const pendingCount = history.filter((h) => h.status === "pending").length;
  // Hedefe ulaşılmadıysa liste bitince (ya da sadece bekleyen kartlar kalınca) ek kart gelir.
  const wantsExtra = !current && doneToday < dailyGoal && !extraExhausted;
  const waiting = !current && pick.kind === "wait" && !wantsExtra;
  const finished = !current && pick.kind === "empty" && !wantsExtra;

  const previews = useMemo(() => {
    if (!srs || !current || !flipped) return null;
    const now = new Date();
    const dues = srs.previewDueDates(srs.toFsrsCard(current.progress, now), now);
    return Object.fromEntries(
      srs.GRADES.map((g) => [g, srs.formatInterval(now, dues[g])]),
    ) as Record<Grade, string>;
  }, [srs, current, flipped]);

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
      const lib = srsRef.current;
      if (!lib) {
        queuedRating.current = rating;
        return;
      }
      const item = current;
      const answeredAt = new Date();
      const next = lib.review(lib.toFsrsCard(item.progress, answeredAt), rating, answeredAt);
      const requeue = next.due.getTime() - answeredAt.getTime() <= LEARN_AHEAD_MS;
      // Tekrar gelecekse gerçek zamanını bekler ve araya en az MIN_GAP kart girer.
      const optimistic: Slot = {
        ...item,
        isNew: false,
        progress: lib.fromFsrsCard(next),
        availableAt: next.due.getTime(),
        gapLeft: MIN_GAP,
      };

      setExitDir(EXIT_BY_GRADE[rating]);
      setQueue((q) => {
        const rest = countGap(
          q.filter((x) => x.cardId !== item.cardId),
          item.cardId,
        );
        return requeue ? [...rest, optimistic] : rest;
      });
      setNow(answeredAt.getTime());
      setLastCardId(item.cardId);
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
          setQueue((q) => [
            { ...item, availableAt: 0, gapLeft: 0 },
            ...q.filter((x) => x.cardId !== item.cardId),
          ]);
          setLastCardId(null);
          setTurn((t) => t + 1);
          setFlipped(false);
          setNotice(`Couldn't save your answer for "${item.front}" — showing it again.`);
        }
      });
    },
    [current, flipped, pushEntry, updateEntry],
  );

  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    let alive = true;
    void loadSrs().then((lib) => {
      if (!alive) return;
      srsRef.current = lib;
      setSrs(lib);
      const queued = queuedRating.current;
      queuedRating.current = null;
      if (queued) answerRef.current(queued);
    });
    return () => {
      alive = false;
    };
  }, []);

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
      setQueue((q) => [
        { ...entry.item, availableAt: 0, gapLeft: 0 },
        ...q.filter((x) => x.cardId !== entry.item.cardId),
      ]);
      setLastCardId(null);
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

  // Sadece dönüş zamanını bekleyen kartlar kaldıysa: geri sayım için saniyede bir saat güncellenir.
  const waitUntil = pick.kind === "wait" ? pick.until : null;
  useEffect(() => {
    if (waitUntil === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [waitUntil]);

  // Günlük hedefe ulaşılmadan kart kalmadıysa ek kartlar kendiliğinden gelir (düğme yok).
  useEffect(() => {
    if (!wantsExtra || fetchingExtra.current) return;
    fetchingExtra.current = true;
    const seen = new Set([
      ...queue.map((q) => q.cardId),
      ...historyRef.current.map((h) => h.item.cardId),
    ]);
    extraCards({ deckId, exclude: [...seen], limit: EXTRA_BATCH })
      .then((result) => {
        const fresh = result.ok ? result.items.filter((item) => !seen.has(item.cardId)) : [];
        if (fresh.length === 0) {
          setExtraExhausted(true);
          return;
        }
        setQueue((q) => [...q, ...fresh.map((item) => ({ ...toSlot(item), availableAt: 0 }))]);
        setNow(Date.now());
      })
      .catch(() => setExtraExhausted(true))
      .finally(() => {
        fetchingExtra.current = false;
      });
  }, [wantsExtra, deckId, queue]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-3 sm:flex-none sm:gap-4">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>
            Goal {doneToday} / {dailyGoal}
          </span>
          {!finished ? (
            <span className="flex gap-1.5">
              <span className="border-ink bg-blue text-on-accent rounded-full border-2 px-2">
                {reviewLeft} due
              </span>
              <span className="border-ink bg-teal text-on-accent rounded-full border-2 px-2">
                {newLeft} new
              </span>
            </span>
          ) : null}
        </div>
        <ProgressBar value={doneToday} max={dailyGoal} label="Daily goal" />
      </div>

      {current ? (
        <>
          <div className="relative my-1 min-h-0 flex-1 max-sm:max-h-[28rem] sm:my-2 sm:flex-none">
            {/* Bildirim yer kaplamaz: kartın üstünde süzülür. */}
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-x-0 -top-2 z-20 text-sm"
            >
              <AnimatePresence mode="wait" initial={false}>
                {notice ? (
                  <m.p
                    key={notice}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="border-ink bg-yellow text-on-accent shadow-hard-sm inline-block rounded-lg border-2 px-2 py-0.5 font-bold"
                  >
                    {notice}
                  </m.p>
                ) : null}
              </AnimatePresence>
            </div>
            {/* Arkada eğik duran ikinci kart: destenin devam ettiğini hissettirir. */}
            <div
              aria-hidden="true"
              className="border-ink bg-blue absolute inset-0 -rotate-3 rounded-3xl border-[3px]"
            />
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

          {/* Tek satır: Listen · Show answer / kaydırma ipucu · Undo. Dikey yer kazandırır, kart büyük kalır. */}
          <div className="flex items-stretch gap-2">
            {speechAvailable ? (
              <button
                type="button"
                className={buttonClass("secondary", "size-14 shrink-0 px-0!")}
                onClick={() => speak(current.front, current.sourceLang)}
                aria-label={`Listen to "${current.front}"`}
              >
                <SpeakerIcon size={22} />
              </button>
            ) : null}
            <AnimatePresence mode="wait" initial={false}>
              {flipped ? (
                // Puan düğmeleri yok (Tuna'nın isteği): telefonda kaydır, klavyede 1-4.
                <m.p
                  key="swipe-hint"
                  className="border-ink flex min-h-14 min-w-0 flex-1 items-center justify-between gap-1 rounded-xl border-[2.5px] border-dashed px-3 text-sm font-bold"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                >
                  <span>← Again · {previews?.[1]}</span>
                  <span>Good · {previews?.[3]} →</span>
                </m.p>
              ) : (
                <m.button
                  key="show"
                  type="button"
                  className={buttonClass("primary", "min-h-14 min-w-0 flex-1 text-lg")}
                  onClick={() => setFlipped(true)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                >
                  Show answer
                </m.button>
              )}
            </AnimatePresence>
            <button
              type="button"
              className={buttonClass("secondary", "size-14 shrink-0 px-0!")}
              onClick={undo}
              disabled={!lastUndoable}
              aria-label="Undo last answer"
            >
              <UndoIcon size={22} />
            </button>
          </div>
          <p className="text-ink-soft hidden text-center text-xs sm:block">
            Keys: Space = flip · 1 Again · 2 Hard · 3 Good · 4 Easy · Z = undo
          </p>
          <p className="text-ink-soft text-center text-xs sm:hidden">
            Tap to flip, then swipe right = Good, left = Again.
          </p>
        </>
      ) : waiting && pick.kind === "wait" ? (
        <WaitPanel
          secondsLeft={Math.max(1, Math.ceil((pick.until - now) / 1000))}
          waitingCount={queue.length}
          goalReached={doneToday >= dailyGoal}
          canUndo={lastUndoable}
          onUndo={undo}
          backHref={backHref}
        />
      ) : wantsExtra ? (
        <p role="status" className="text-ink-soft py-10 text-center font-bold">
          Loading more cards…
        </p>
      ) : (
        <m.section
          aria-labelledby="summary"
          className="brutal-card flex flex-col items-center gap-4 p-6 text-center"
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
          <h1 id="summary" className="text-3xl font-bold tracking-tight">
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
            <p className="text-ink-soft">
              There are no cards to study here right now. Add new words to keep learning.
            </p>
          )}
          {summary && summary.streak > 0 ? (
            <m.p
              className="border-ink bg-yellow text-on-accent shadow-hard-sm flex items-center gap-1.5 rounded-full border-[2.5px] px-3 py-1 font-bold"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <FlameIcon size={18} />
              {summary.streak}-day streak
            </m.p>
          ) : null}
          {pendingCount > 0 ? <p className="text-ink-soft text-sm">Saving your answers…</p> : null}
          <div className="flex flex-wrap justify-center gap-2">
            {lastUndoable ? (
              <button type="button" className={buttonClass("secondary")} onClick={undo}>
                <UndoIcon size={18} />
                Undo last answer
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
      className={`relative h-full w-full touch-pan-y select-none [perspective:1200px] ${
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
        className="border-ink bg-red text-on-accent shadow-hard-sm pointer-events-none absolute top-4 right-4 z-10 rotate-12 rounded-lg border-[2.5px] px-2 py-0.5 text-sm font-bold"
      >
        AGAIN{intervals ? <span className="ml-1 font-medium">{intervals[1]}</span> : null}
      </m.span>
      <m.span
        aria-hidden="true"
        style={{ opacity: goodOpacity }}
        className="border-ink bg-teal text-on-accent shadow-hard-sm pointer-events-none absolute top-4 left-4 z-10 -rotate-12 rounded-lg border-[2.5px] px-2 py-0.5 text-sm font-bold"
      >
        GOOD{intervals ? <span className="ml-1 font-medium">{intervals[3]}</span> : null}
      </m.span>

      <m.div
        className="grid h-full [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 24 }}
      >
        <Face hidden={flipped}>
          {item.isNew ? (
            <span className="border-ink bg-teal text-on-accent absolute top-3 left-3 rounded-full border-2 px-2 py-0.5 text-xs font-bold">
              new
            </span>
          ) : null}
          <p lang={item.sourceLang} className="text-4xl font-bold tracking-tight break-words">
            {item.front}
          </p>
          <p className="text-ink-soft text-sm font-medium">Tap to reveal</p>
        </Face>
        <Face back hidden={!flipped}>
          <p lang={item.sourceLang} className="text-ink-soft text-lg font-medium">
            {item.front}
          </p>
          <hr className="border-ink w-16 border-t-[2.5px]" />
          <p lang={item.targetLang} className="text-3xl font-bold tracking-tight break-words">
            {item.back}
          </p>
          {item.example ? (
            <p
              lang={item.sourceLang}
              className="border-ink rounded-xl border-[2.5px] border-dashed px-3 py-2 text-base font-medium"
            >
              {item.example}
            </p>
          ) : null}
          {item.note ? <p className="text-ink-soft text-sm">{item.note}</p> : null}
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
      className="border-ink bg-surface shadow-hard-lg relative col-start-1 row-start-1 flex min-h-0 flex-col items-center [justify-content:safe_center] gap-3 overflow-y-auto rounded-3xl border-[3px] p-6 text-center sm:min-h-80"
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

/**
 * Sadece dönüş zamanını bekleyen kartlar kaldı: geri sayım. Süre dolunca kart kendiliğinden gelir.
 * (Önceden kart beklemeden hemen tekrar gösteriliyor, iki kart arasında gidip geliniyordu.)
 */
function WaitPanel({
  secondsLeft,
  waitingCount,
  goalReached,
  canUndo,
  onUndo,
  backHref,
}: {
  secondsLeft: number;
  waitingCount: number;
  goalReached: boolean;
  canUndo: boolean;
  onUndo: () => void;
  backHref: string;
}) {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  return (
    <m.section
      aria-labelledby="waiting"
      className="brutal-card flex flex-col items-center gap-3 p-6 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <h1 id="waiting" className="text-2xl font-bold tracking-tight">
        {goalReached ? "Daily goal reached!" : "Short break"}
      </h1>
      <p className="font-medium">Next card in</p>
      <p
        className="border-ink bg-yellow text-on-accent shadow-hard-sm rounded-xl border-[2.5px] px-4 py-1 text-4xl font-bold tabular-nums"
        role="timer"
        aria-live="off"
      >
        {minutes}:{seconds}
      </p>
      <p className="text-ink-soft text-sm">
        {waitingCount === 1 ? "1 card is" : `${waitingCount} cards are`} coming back after a short
        break, so you remember them better. You can wait here or come back later.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {canUndo ? (
          <button type="button" className={buttonClass("secondary")} onClick={onUndo}>
            <UndoIcon size={18} />
            Undo last answer
          </button>
        ) : null}
        <Link href={backHref} className={buttonClass("primary")}>
          Done for now
        </Link>
      </div>
    </m.section>
  );
}

function noopSubscribe() {
  return () => undefined;
}

function Stat({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <m.div
      className="brutal-box p-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 + index * 0.08 }}
    >
      <dt className="text-ink-soft text-sm">{label}</dt>
      <dd className="text-2xl font-bold">{value}</dd>
    </m.div>
  );
}
