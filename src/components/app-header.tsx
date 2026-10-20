import Link from "next/link";
import { signOut } from "@/app/actions";
import { LogOutIcon } from "@/components/icons";
import { BottomNav, TopNav } from "@/components/nav-links";
import { buttonClass } from "@/components/ui/button";

export function AppHeader() {
  return (
    <>
      <header className="border-ink bg-paper sticky top-0 z-20 border-b-[3px]">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link
            href="/"
            className="bg-ink text-paper rounded-lg px-2.5 py-1 text-lg font-bold tracking-tight"
          >
            KelimeKart
          </Link>
          <TopNav />
          <form action={signOut}>
            <button type="submit" className={buttonClass("ghost", "px-3 text-sm")}>
              <LogOutIcon size={18} />
              Log out
            </button>
          </form>
        </div>
      </header>
      <BottomNav />
    </>
  );
}
