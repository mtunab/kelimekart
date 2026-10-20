/** Yüklenirken içerik yerine gösterilen, yumuşak yanıp sönen kenarlı kutu. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`border-ink/20 bg-ink/10 animate-pulse rounded-2xl border-[2.5px] motion-reduce:animate-none ${className}`}
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
