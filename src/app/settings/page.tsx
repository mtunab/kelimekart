import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { parseTheme, THEME_COOKIE, THEME_LABELS, THEMES } from "@/lib/theme";
import { setTheme } from "./actions";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Ayarlar · KelimeKart" };

export default async function SettingsPage() {
  const [{ profile, user }, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const zones = Intl.supportedValuesOf("timeZone");
  if (!zones.includes(profile.timezone)) zones.unshift(profile.timezone);

  return (
    <PageShell displayName={profile.display_name}>
      <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>

      <section
        aria-labelledby="profil"
        className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 id="profil" className="mb-3 text-lg font-semibold">
          Profil ve çalışma
        </h2>
        <ProfileForm profile={profile} zones={zones} />
      </section>

      <section
        aria-labelledby="tema"
        className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 id="tema" className="mb-3 text-lg font-semibold">
          Tema
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Tema seç">
          {THEMES.map((t) => (
            <form key={t} action={setTheme}>
              <input type="hidden" name="theme" value={t} />
              <button
                type="submit"
                aria-pressed={theme === t}
                className={buttonClass(theme === t ? "primary" : "secondary")}
              >
                {THEME_LABELS[t]}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="sifre"
        className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 id="sifre" className="mb-1 text-lg font-semibold">
          Şifre değiştir
        </h2>
        <p className="mb-3 text-sm text-zinc-500">{user.email}</p>
        <PasswordForm />
      </section>
    </PageShell>
  );
}
