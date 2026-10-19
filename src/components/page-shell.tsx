import type { ReactNode } from "react";
import { AppHeader } from "@/components/app-header";

export function PageShell({
  displayName,
  children,
  width = "max-w-3xl",
}: {
  displayName: string;
  children: ReactNode;
  width?: string;
}) {
  return (
    <>
      <AppHeader displayName={displayName} />
      {/* Altta mobil menü için boşluk (pb-24). */}
      <main
        className={`mx-auto flex w-full ${width} flex-1 flex-col gap-6 px-4 pt-6 pb-24 sm:pb-6`}
      >
        {children}
      </main>
    </>
  );
}
