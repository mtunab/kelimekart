import Link from "next/link";
import { signOut } from "@/app/actions";
import { buttonClass } from "@/components/ui/button";

export function AppHeader({ displayName }: { displayName: string }) {
  return (
    <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-2">
        <Link
          href="/"
          className="rounded-md px-1 py-2 text-lg font-semibold tracking-tight text-indigo-700 dark:text-indigo-300"
        >
          KelimeKart
        </Link>
        <div className="flex items-center gap-1">
          <span className="hidden text-sm text-zinc-600 sm:inline dark:text-zinc-400">
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
  );
}
