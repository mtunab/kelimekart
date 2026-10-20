"use client";

import { m, useSpring, useTransform, useVelocity, type MotionValue } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType } from "react";
import { DecksIcon, SettingsIcon, StatsIcon, StudyIcon } from "@/components/icons";

type NavItem = { href: string; label: string; Icon: ComponentType<{ size?: number }> };

export const NAV: readonly NavItem[] = [
  { href: "/", label: "Study", Icon: StudyIcon },
  { href: "/decks", label: "Decks", Icon: DecksIcon },
  { href: "/stats", label: "Stats", Icon: StatsIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/study");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeIndexOf(pathname: string) {
  return Math.max(
    0,
    NAV.findIndex((item) => isActive(pathname, item.href)),
  );
}

/** Masaüstü üst menüsü: seçili sekmenin pembe zemini sekmeler arasında kayar. */
export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative isolate inline-flex min-h-11 items-center gap-2 rounded-full border-[2.5px] px-4 text-sm font-bold ${
              active ? "border-ink text-on-accent" : "text-ink hover:border-ink border-transparent"
            }`}
          >
            {active ? (
              <m.span
                layoutId="top-nav-pill"
                aria-hidden="true"
                className="bg-pink absolute inset-0 -z-10 rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            ) : null}
            <item.Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

const PAD = 6; // kapsülün iç boşluğu (px)
const HOLD_MS = 200; // basılı tutma süresi: sonra baloncuk açılır
const DRAG_START_PX = 6; // bu kadar kayınca beklemeden baloncuk açılır
const LENS_SCALE = 1.15;
const SLIDE = { stiffness: 420, damping: 28 };

type Gesture = {
  id: number;
  startX: number;
  lastX: number;
  lens: boolean;
  timer: number | null;
};

/**
 * Telefon alt menüsü: yüzen kapsül. iOS 26'daki gibi:
 * - Dokununca seçim, yeni sekmeye esneyerek (hıza göre uzayıp yassılarak) kayar; varılan simge zıplar.
 * - Basılı tutunca seçim büyüyüp kalkan bir "baloncuğa" dönüşür, altındaki simge büyür.
 *   Parmak kaydırıldıkça baloncuk peşinden gelir; bırakınca en yakın sekmeye yaylanıp oturur
 *   ve o sayfa açılır.
 * Bağlantılar gerçek <a> olarak kalır (klavye ve ekran okuyucu için).
 */
export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const activeIndex = activeIndexOf(pathname);
  // Dokunur dokunmaz gösterge kayar; sayfa gelene kadar beklemez. Sayfa değişince sıfırlanır.
  const [pending, setPending] = useState<{ index: number; from: string } | null>(null);
  const shown = pending && pending.from === pathname ? pending.index : activeIndex;

  const barRef = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState(0);
  const [lens, setLens] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const placed = useRef(false);
  const suppressClick = useRef(false);

  // Göstergenin konumu bir yay: her .set() yeni hedefe yaylanarak gider, .jump() anında koyar.
  const x = useSpring(0, SLIDE);
  const lensScale = useSpring(1, { stiffness: 520, damping: 22 });
  const stretch = useStretch(x);
  const scaleX = useTransform(() => lensScale.get() * stretch.get());
  const scaleY = useTransform(() => lensScale.get() * (1.5 - stretch.get() / 2));
  const lift = useTransform(lensScale, [1, LENS_SCALE], [0, -6]);
  const bubbleShadow = useTransform(lensScale, (s) => {
    const o = Math.max(0, Math.round(((s - 1) / (LENS_SCALE - 1)) * 4));
    return `${o}px ${o}px 0 var(--ink)`;
  });
  const barScale = useTransform(lensScale, [1, LENS_SCALE], [1, 1.03]);

  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setSlot((el.clientWidth - PAD * 2) / NAV.length);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Seçili sekme değişince gösterge oraya kayar (ilk ölçümde animasyonsuz yerleşir).
  useEffect(() => {
    if (!slot || gesture.current?.lens) return;
    if (!placed.current) {
      placed.current = true;
      x.jump(shown * slot);
      return;
    }
    x.set(shown * slot);
  }, [shown, slot, x]);

  function localX(clientX: number) {
    const el = barRef.current;
    if (!el) return 0;
    return clientX - el.getBoundingClientRect().left - el.clientLeft - PAD;
  }

  function indexAt(px: number) {
    return Math.min(NAV.length - 1, Math.max(0, Math.floor(px / slot)));
  }

  function follow(clientX: number) {
    const px = localX(clientX);
    x.set(Math.min(slot * (NAV.length - 1), Math.max(0, px - slot / 2)));
    setHover(indexAt(px));
  }

  function startLens() {
    const g = gesture.current;
    if (!g || g.lens) return;
    g.lens = true;
    try {
      barRef.current?.setPointerCapture(g.id);
    } catch {
      // Parmak bu arada kalktıysa yakalama gerekmez.
    }
    setLens(true);
    lensScale.set(LENS_SCALE);
    follow(g.lastX);
  }

  function endGesture() {
    const g = gesture.current;
    if (g?.timer) window.clearTimeout(g.timer);
    gesture.current = null;
    return g;
  }

  function finishLens(index: number) {
    setLens(false);
    setHover(null);
    lensScale.set(1);
    x.set(index * slot);
    if (index !== activeIndex) {
      setPending({ index, from: pathname });
      navigator.vibrate?.(8);
      router.push(NAV[index]!.href);
    }
  }

  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md sm:hidden"
    >
      <m.div
        ref={barRef}
        className="border-ink bg-surface shadow-hard relative grid touch-none grid-cols-4 rounded-full border-[3px] select-none [-webkit-touch-callout:none]"
        style={{ padding: PAD, scale: barScale }}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (event.button !== 0 || !slot) return;
          const g: Gesture = {
            id: event.pointerId,
            startX: event.clientX,
            lastX: event.clientX,
            lens: false,
            timer: null,
          };
          g.timer = window.setTimeout(startLens, HOLD_MS);
          gesture.current = g;
        }}
        onPointerMove={(event) => {
          const g = gesture.current;
          if (!g || g.id !== event.pointerId) return;
          g.lastX = event.clientX;
          if (g.lens) follow(event.clientX);
          else if (Math.abs(event.clientX - g.startX) > DRAG_START_PX) startLens();
        }}
        onPointerUp={(event) => {
          const g = endGesture();
          if (!g?.lens) return;
          // Baloncuk bırakıldı: alttaki bağlantının ayrıca tıklanmasını engelle.
          suppressClick.current = true;
          window.setTimeout(() => (suppressClick.current = false), 0);
          finishLens(indexAt(localX(event.clientX)));
        }}
        onPointerCancel={() => {
          const g = endGesture();
          if (g?.lens) finishLens(shown);
        }}
        onClickCapture={(event) => {
          if (!suppressClick.current) return;
          event.preventDefault();
          event.stopPropagation();
        }}
      >
        <m.span
          aria-hidden="true"
          className="border-ink bg-pink absolute rounded-full border-[2.5px]"
          style={{
            top: PAD,
            bottom: PAD,
            left: PAD,
            width: slot,
            x,
            y: lift,
            scaleX,
            scaleY,
            boxShadow: bubbleShadow,
          }}
        />
        {NAV.map((item, index) => {
          const selected = index === shown;
          const magnified = lens && hover === index;
          return (
            <Link
              key={item.href}
              href={item.href}
              draggable={false}
              aria-current={index === activeIndex ? "page" : undefined}
              onClick={() => {
                if (index !== activeIndex) setPending({ index, from: pathname });
              }}
              className={`relative z-10 flex h-14 flex-col items-center justify-center gap-0.5 rounded-full text-xs font-bold ${
                selected && !lens ? "text-on-accent" : "text-ink"
              }`}
            >
              {/* Seçilince simge zıplar (yeniden takılınca yaylanarak büyür). */}
              <m.span
                key={selected ? `on-${shown}` : "off"}
                initial={selected ? { scale: 0.55 } : false}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 520, damping: 13 }}
                className="flex"
              >
                <m.span
                  className="flex"
                  animate={{ scale: magnified ? 1.3 : 1, y: magnified ? -3 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 24 }}
                >
                  <item.Icon size={22} />
                </m.span>
              </m.span>
              {item.label}
            </Link>
          );
        })}
      </m.div>
    </nav>
  );
}

/** Kayma hızına göre esneme: hızlı giderken uzar, durunca yaylanarak eski haline döner. */
function useStretch(x: MotionValue<number>) {
  const velocity = useVelocity(x);
  const raw = useTransform(velocity, [-2400, 0, 2400], [1.18, 1, 1.18]);
  return useSpring(raw, { stiffness: 600, damping: 38 });
}
