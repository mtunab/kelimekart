"use client";

import { useActionState } from "react";
import { createDeck, updateDeck } from "@/app/(app)/decks/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";

const languageOptions = LANGUAGES.map((l) => ({ value: l.code, label: l.label }));

export function DeckForm({
  deck,
}: {
  deck?: { id: string; name: string; source_lang: string; target_lang: string };
}) {
  const [state, action] = useActionState(deck ? updateDeck : createDeck, undefined);
  const values = state?.values;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {deck ? <input type="hidden" name="deckId" value={deck.id} /> : null}
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field
        label="Deck name"
        id="name"
        required
        maxLength={80}
        placeholder="e.g. Everyday verbs"
        defaultValue={values?.name ?? deck?.name}
      />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Word language"
          id="source_lang"
          options={languageOptions}
          defaultValue={values?.source_lang ?? deck?.source_lang ?? "en"}
        />
        <SelectField
          label="Meaning language"
          id="target_lang"
          options={languageOptions}
          defaultValue={values?.target_lang ?? deck?.target_lang ?? "tr"}
        />
      </div>
      <SubmitButton pendingText="Saving…">{deck ? "Save" : "Create deck"}</SubmitButton>
    </form>
  );
}
