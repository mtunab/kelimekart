import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Help · KelimeKart" };

/** Kullanım kılavuzu (KULLANIM.md ile aynı içerik). Girişsiz de açılır; kişisel veri yok. */
export default function HelpPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <Link
        href="/"
        className="self-start rounded-lg py-1 text-sm font-bold underline decoration-2 underline-offset-4"
      >
        ← KelimeKart
      </Link>
      <div>
        <h1 className="text-4xl font-bold tracking-tight">User guide</h1>
        <p className="text-ink-soft mt-1">
          KelimeKart helps you memorize words for good: it shows each card again right before
          you&apos;d forget it.
        </p>
      </div>

      <Section title="1. First login">
        <ol className="list-decimal space-y-1 pl-5">
          <li>
            The group admin gives you a <strong>username</strong> and a <strong>password</strong>.
            Open the site and log in with them.
          </li>
          <li>
            If you like, set your own password under <em>Settings → Change password</em> (at least 8
            characters). Your account is permanent; only the admin can remove it.
          </li>
          <li>
            <strong>Add it to your phone like an app:</strong> iPhone (Safari) → Share →{" "}
            <em>Add to Home Screen</em>. Android (Chrome) → ⋮ menu → <em>Install app</em>.
          </li>
        </ol>
      </Section>

      <Section title="2. Decks and words">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Decks</strong> → &quot;New deck&quot;: pick a name and a language pair.
          </li>
          <li>
            <strong>Quick add:</strong> type the <em>Word</em> → Enter → type the <em>Meaning</em> →
            Enter. The fields clear so you can type the next word. If the word already exists,
            you&apos;ll see &quot;already in this deck&quot;.
          </li>
          <li>
            <strong>Bulk add:</strong> <em>Import</em> → write{" "}
            <code className="bg-ink/10 rounded px-1">word ; meaning ; example</code> on each line,
            or paste from Excel → <em>Preview</em> → <em>Add</em>.
          </li>
          <li>
            Tap a word in the list to edit it; you can add an example sentence, a note and tags.
          </li>
          <li>
            <strong>Archive</strong>: the card stops appearing in study (it isn&apos;t deleted and
            can be restored).
          </li>
          <li>
            <strong>Members:</strong> words are shared, but everyone&apos;s progress is their own.
          </li>
        </ul>
      </Section>

      <Section title="3. Studying">
        <p>
          The <strong>Study</strong> tab shows what&apos;s waiting today. Tap{" "}
          <em>Start studying</em>, look at the word, say the meaning in your head, flip the card and
          tell the app how well you remembered:
        </p>
        <div className="brutal-card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-yellow text-on-accent">
              <tr>
                <th className="p-2">Answer</th>
                <th className="p-2">When</th>
                <th className="p-2">How</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Again", "I didn't remember", "Swipe left · key 1"],
                ["Hard", "I remembered, but it was hard", "Key 2"],
                ["Good", "I remembered", "Swipe right · key 3"],
                ["Easy", "I knew it instantly", "Key 4"],
              ].map(([answer, when, key]) => (
                <tr key={answer} className="border-ink border-t-[2.5px]">
                  <td className="p-2 font-medium">{answer}</td>
                  <td className="p-2">{when}</td>
                  <td className="p-2">{key}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Under the card you&apos;ll see when it comes back for each answer. Be honest; the app
            handles the rest.
          </li>
          <li>
            <strong>Flip:</strong> tap the card or press Space. Then drag the card: right = Good,
            left = Again (works with a mouse too). On a keyboard, 1–4 gives all four answers.
          </li>
          <li>
            <strong>Listen</strong> reads the word aloud. <strong>Undo</strong> (Z on a keyboard)
            takes back your last answer.
          </li>
          <li>By default you get 10 new cards a day plus the reviews that are due.</li>
          <li>
            If you finish today&apos;s cards before your daily goal, more cards come automatically:
            first new words, then words that are due soon.
          </li>
          <li>
            A card you got wrong comes back after a short break (about 1&ndash;10 minutes), never
            twice in a row. If only those cards are left, a countdown shows when the next one is
            ready.
          </li>
          <li>
            A new day starts at 4:00 AM. Study at least one card every day to grow your streak (the
            flame); skip a day and it resets.
          </li>
        </ul>
      </Section>

      <Section title="4. Stats and settings">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Stats:</strong> today and the last 7 days, accuracy, streak, a 14-day forecast,
            and new / learning / mature cards per deck. The <strong>group board</strong> shows only
            each person&apos;s name, today&apos;s review count and streak.
          </li>
          <li>
            <strong>Settings:</strong> display name, time zone, new cards per day, daily goal,
            password, theme.
          </li>
          <li>
            <strong>On a phone:</strong> tap a tab in the bottom menu, or press and hold the menu
            and slide your finger to the tab you want, then let go.
          </li>
        </ul>
      </Section>

      <Section title="5. Troubleshooting">
        <ul className="list-disc space-y-1 pl-5">
          <li>Forgot your password: tell the group admin; they&apos;ll give you a new one.</li>
          <li>&quot;Too many attempts&quot;: wait 5 minutes.</li>
          <li>
            No new cards: today&apos;s new-card limit is reached; you can raise it in Settings.
          </li>
          <li>&quot;Listen&quot; makes no sound: your device has no voice for that language.</li>
          <li>
            The app needs the internet; once you&apos;re back online, carry on where you left off.
          </li>
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="text-ink flex flex-col gap-2">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}
