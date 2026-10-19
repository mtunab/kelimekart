import Link from "next/link";
import { signOut } from "@/app/actions";
import { buttonClass } from "@/components/ui/button";

const NAV = [
  { href: "/", label: "Desteler", icon: "🗂️" },
  { href: "/study", label: "Çalış", icon: "📖" },
  { href: "/stats", label: "İstatistik", icon: "📊" },
  { href: "/settings", label: "Ayarlar", icon: "⚙️" },
] as const;

export function AppHeader({ displayName }: { displayName: string }) {
  return (
    <>
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link
            href="/"
            className="rounded-md px-1 py-2 text-lg font-semibold tracking-tight text-indigo-700 dark:text-indigo-300"
          >
            KelimeKart
          </Link>
          <nav aria-label="Ana menü" className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={buttonClass("ghost", "text-sm")}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <span className="hidden text-sm text-zinc-600 md:inline dark:text-zinc-400">
              {displayName}
            </span>
            <form action={signOut}>
              <button type="submit" className={buttonClass("ghost", "text-sm")}>
                Çıkış
              </button>
            </form>
          </div>
        </div>
      </header>
      {/* Telefonda başparmakla ulaşılsın diye alt menü. */}
      <nav
        aria-label="Alt menü"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-zinc-950/95"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-zinc-700 dark:text-zinc-300"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
