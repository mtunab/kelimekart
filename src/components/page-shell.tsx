import type { ReactNode } from "react";

/** Giriş yapılmış sayfaların içerik alanı. Üst/alt menü `(app)/layout.tsx` içinde, sayfa değişse de yerinde kalır. */
export function PageShell({
  children,
  width = "max-w-3xl",
}: {
  children: ReactNode;
  width?: string;
}) {
  return (
    // Altta mobil menü için boşluk (pb-32).
    <main className={`mx-auto flex w-full ${width} flex-1 flex-col gap-6 px-4 pt-6 pb-32 sm:pb-8`}>
      {children}
    </main>
  );
}
