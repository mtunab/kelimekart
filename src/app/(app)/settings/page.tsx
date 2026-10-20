import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { parseTheme, THEME_COOKIE, THEME_LABELS, THEMES } from "@/lib/theme";
import { setTheme } from "./actions";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata: Metadata = { title: "Settings · KelimeKart" };

export default async function SettingsPage() {
  const [{ profile }, cookieStore] = await Promise.all([requireUser(), cookies()]);
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value);
  const zones = Intl.supportedValuesOf("timeZone");
  if (!zones.includes(profile.timezone)) zones.unshift(profile.timezone);

  return (
    <PageShell>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <Link href="/help" className={buttonClass("secondary", "text-sm")}>
          Help
        </Link>
      </div>

      <section
        aria-labelledby="profile"
        className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 id="profile" className="mb-3 text-lg font-semibold">
          Profile &amp; study
        </h2>
        <ProfileForm profile={profile} zones={zones} />
      </section>

      <section
        aria-labelledby="theme"
        className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 id="theme" className="mb-3 text-lg font-semibold">
          Theme
        </h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Choose theme">
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
        aria-labelledby="password-heading"
        className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h2 id="password-heading" className="mb-1 text-lg font-semibold">
          Change password
        </h2>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          Your username: <strong>{profile.username}</strong>
        </p>
        <PasswordForm />
      </section>
    </PageShell>
  );
}
