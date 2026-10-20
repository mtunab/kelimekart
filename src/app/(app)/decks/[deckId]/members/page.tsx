import type { Metadata } from "next";
import Link from "next/link";
import { removeMember } from "@/app/(app)/decks/actions";
import { PageShell } from "@/components/page-shell";
import { buttonClass } from "@/components/ui/button";
import { requireDeck } from "@/lib/decks";
import { AddMemberForm } from "./add-member-form";

export const metadata: Metadata = { title: "Members · KelimeKart" };

export default async function MembersPage({ params }: PageProps<"/decks/[deckId]/members">) {
  const { deckId } = await params;
  const { supabase, deck, isOwner, user } = await requireDeck(deckId);

  const [membersResult, groupResult] = await Promise.all([
    supabase.from("deck_members").select("user_id, role").eq("deck_id", deck.id),
    supabase.rpc("list_group_profiles"),
  ]);
  const group = (groupResult.data ?? []) as { id: string; display_name: string }[];
  const names = new Map(group.map((p) => [p.id, p.display_name]));
  const members = (membersResult.data ?? [])
    .map((m) => ({ ...m, name: names.get(m.user_id) ?? "User" }))
    .sort((a, b) =>
      a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name, "en"),
    );
  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = group.filter((p) => !memberIds.has(p.id));

  return (
    <PageShell>
      <Link
        href={`/decks/${deck.id}`}
        className="self-start rounded-lg py-1 text-sm font-bold underline decoration-2 underline-offset-4"
      >
        ← {deck.name}
      </Link>
      <h1 className="text-4xl font-bold tracking-tight">Members</h1>
      <p className="text-ink-soft text-sm">
        Members can see this deck and add words. Everyone&apos;s study progress is their own.
      </p>

      <ul className="brutal-card divide-ink divide-y-[2.5px] overflow-hidden">
        {members.map((m) => (
          <li key={m.user_id} className="flex min-h-14 items-center justify-between gap-2 p-3">
            <span>
              {m.name}
              {m.user_id === user.id ? " (you)" : ""}
              <span className="text-ink-soft ml-2 text-sm">
                {m.role === "owner" ? "owner" : "member"}
              </span>
            </span>
            {m.role === "member" && (isOwner || m.user_id === user.id) ? (
              <form action={removeMember}>
                <input type="hidden" name="deckId" value={deck.id} />
                <input type="hidden" name="userId" value={m.user_id} />
                <button type="submit" className={buttonClass("ghost", "text-sm")}>
                  {m.user_id === user.id ? "Leave deck" : "Remove"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <section className="brutal-card p-4">
          <h2 className="mb-3 text-xl font-bold">Add member</h2>
          {candidates.length ? (
            <AddMemberForm deckId={deck.id} candidates={candidates} />
          ) : (
            <p className="text-ink-soft text-sm">
              Everyone in the group is already a member of this deck.
            </p>
          )}
        </section>
      ) : null}
    </PageShell>
  );
}
