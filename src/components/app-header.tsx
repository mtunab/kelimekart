import Link from "next/link";
import { signOut } from "@/app/actions";
import { BottomNav, TopNav } from "@/components/nav-links";
import { buttonClass } from "@/components/ui/button";

export function AppHeader() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link
            href="/"
            className="rounded-md px-1 py-2 text-lg font-semibold tracking-tight text-indigo-700 dark:text-indigo-300"
          >
            KelimeKart
          </Link>
          <TopNav />
          <form action={signOut}>
            <button type="submit" className={buttonClass("ghost", "text-sm")}>
              Log out
            </button>
          </form>
        </div>
      </header>
      <BottomNav />
    </>
  );
}
