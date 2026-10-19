import type { Metadata } from "next";
import Link from "next/link";
import { removeMember } from "@/app/decks/actions";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { requireDeck } from "@/lib/decks";
import { AddMemberForm } from "./add-member-form";

export const metadata: Metadata = { title: "Üyeler · KelimeKart" };

export default async function MembersPage({ params }: PageProps<"/decks/[deckId]/members">) {
  const { deckId } = await params;
  const { supabase, profile, deck, isOwner, user } = await requireDeck(deckId);

  const [membersResult, groupResult] = await Promise.all([
    supabase.from("deck_members").select("user_id, role").eq("deck_id", deck.id),
    supabase.rpc("list_group_profiles"),
  ]);
  const group = (groupResult.data ?? []) as { id: string; display_name: string }[];
  const names = new Map(group.map((p) => [p.id, p.display_name]));
  const members = (membersResult.data ?? [])
    .map((m) => ({ ...m, name: names.get(m.user_id) ?? "Kullanıcı" }))
    .sort((a, b) =>
      a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name, "tr"),
    );
  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = group.filter((p) => !memberIds.has(p.id));

  return (
    <PageShell displayName={profile.display_name}>
      <Link
        href={`/decks/${deck.id}`}
        className="self-start rounded-md py-1 text-sm text-indigo-700 dark:text-indigo-300"
      >
        ← {deck.name}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Üyeler</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Üyeler desteyi görür ve kelime ekleyebilir. Herkesin çalışma ilerlemesi kendine özeldir.
      </p>

      <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {members.map((m) => (
          <li key={m.user_id} className="flex min-h-14 items-center justify-between gap-2 p-3">
            <span>
              {m.name}
              {m.user_id === user.id ? " (sen)" : ""}
              <span className="ml-2 text-sm text-zinc-500">
                {m.role === "owner" ? "sahip" : "üye"}
              </span>
            </span>
            {m.role === "member" && (isOwner || m.user_id === user.id) ? (
              <form action={removeMember}>
                <input type="hidden" name="deckId" value={deck.id} />
                <input type="hidden" name="userId" value={m.user_id} />
                <button type="submit" className={buttonClass("ghost", "text-sm")}>
                  {m.user_id === user.id ? "Desteden ayrıl" : "Çıkar"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <section className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-3 text-lg font-semibold">Üye ekle</h2>
          {candidates.length ? (
            <AddMemberForm deckId={deck.id} candidates={candidates} />
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Gruptaki herkes zaten bu destenin üyesi.
            </p>
          )}
        </section>
      ) : null}
    </PageShell>
  );
}
