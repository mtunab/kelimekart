/** Yüklenirken içerik yerine gösterilen gri, yumuşak yanıp sönen kutu. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-2xl bg-zinc-200/80 motion-reduce:animate-none dark:bg-zinc-800/80 ${className}`}
    />
  );
}

/** Ekran okuyucular için "yükleniyor" duyurusu. */
export function LoadingLabel() {
  return (
    <p role="status" className="sr-only">
      Loading…
    </p>
  );
}
