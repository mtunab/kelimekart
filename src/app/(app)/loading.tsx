import { PageShell } from "@/components/page-shell";
import { LoadingLabel, Skeleton } from "@/components/skeleton";

/** Sayfa verisi gelene kadar anında görünen iskelet (menü yerinde kalır). */
export default function Loading() {
  return (
    <PageShell>
      <LoadingLabel />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    </PageShell>
  );
}
