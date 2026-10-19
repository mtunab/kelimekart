import { AppHeader } from "@/components/app-header";
import { Alert } from "@/components/ui/alert";
import { requireUser } from "@/lib/auth";

export default async function Home({ searchParams }: PageProps<"/">) {
  const [{ profile }, params] = await Promise.all([requireUser(), searchParams]);

  return (
    <>
      <AppHeader displayName={profile.display_name} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        {params.durum === "sifre" ? <Alert tone="success">Şifren kaydedildi.</Alert> : null}
        <h1 className="text-2xl font-semibold tracking-tight">Merhaba, {profile.display_name}</h1>
        <p className="text-zinc-600 dark:text-zinc-400">Desteler yakında burada olacak.</p>
      </main>
    </>
  );
}
