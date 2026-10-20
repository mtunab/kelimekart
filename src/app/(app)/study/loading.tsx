import { PageShell } from "@/components/page-shell";
import { LoadingLabel, Skeleton } from "@/components/skeleton";

/** Çalışma ekranı iskeleti: kart ve düğme yerleri, kartlar gelene kadar. */
export default function StudyLoading() {
  return (
    <PageShell width="max-w-xl">
      <LoadingLabel />
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-2.5" />
      <Skeleton className="mt-5 h-72 rounded-3xl" />
      <Skeleton className="h-14" />
    </PageShell>
  );
}
