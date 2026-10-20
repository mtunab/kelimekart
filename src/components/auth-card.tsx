import type { ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="text-center">
        <p className="bg-ink text-paper inline-block rounded-lg px-2.5 py-1 text-lg font-bold tracking-tight">
          KelimeKart
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">{title}</h1>
      </div>
      {children}
    </main>
  );
}
