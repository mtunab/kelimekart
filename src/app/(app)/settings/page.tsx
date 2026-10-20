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
        <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
        <Link href="/help" className={buttonClass("secondary", "text-sm")}>
          Help
        </Link>
      </div>

      <section aria-labelledby="profile" className="brutal-card p-4">
        <h2 id="profile" className="mb-3 text-xl font-bold">
          Profile &amp; study
        </h2>
        <ProfileForm profile={profile} zones={zones} />
      </section>

      <section aria-labelledby="theme" className="brutal-card p-4">
        <h2 id="theme" className="mb-3 text-xl font-bold">
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

      <section aria-labelledby="password-heading" className="brutal-card p-4">
        <h2 id="password-heading" className="mb-1 text-xl font-bold">
          Change password
        </h2>
        <p className="text-ink-soft mb-3 text-sm">
          Your username: <strong>{profile.username}</strong>
        </p>
        <PasswordForm />
      </section>
    </PageShell>
  );
}
