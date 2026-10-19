"use client";

import { useActionState } from "react";
import { addMember } from "@/app/decks/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/alert";
import { SelectField } from "@/components/ui/select";

export function AddMemberForm({
  deckId,
  candidates,
}: {
  deckId: string;
  candidates: { id: string; display_name: string }[];
}) {
  const [state, action] = useActionState(addMember, undefined);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="deckId" value={deckId} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}
      <SelectField
        label="Kişi"
        id="userId"
        options={candidates.map((c) => ({ value: c.id, label: c.display_name }))}
      />
      <SubmitButton pendingText="Ekleniyor…">Ekle</SubmitButton>
    </form>
  );
}
