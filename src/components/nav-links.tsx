"use client";

import { m } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV = [
  { href: "/", label: "Study", icon: "📖" },
  { href: "/decks", label: "Decks", icon: "🗂️" },
  { href: "/stats", label: "Stats", icon: "📊" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/study");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Masaüstü üst menüsü: seçili sekmenin altındaki çizgi sekmeler arasında kayar. */
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
            className={`relative inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors ${
              active
                ? "text-indigo-700 dark:text-indigo-300"
                : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {item.label}
            {active ? (
              <m.span
                layoutId="top-nav-underline"
                className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-indigo-600 dark:bg-indigo-400"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Telefon alt menüsü (başparmakla ulaşılır); seçili sekmenin arka planı kayarak geçer. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Bottom"
      className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative isolate flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
              active
                ? "font-semibold text-indigo-700 dark:text-indigo-300"
                : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            {active ? (
              <m.span
                layoutId="bottom-nav-pill"
                className="absolute inset-x-3 inset-y-1.5 -z-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            ) : null}
            <span aria-hidden="true" className="text-lg leading-none">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
