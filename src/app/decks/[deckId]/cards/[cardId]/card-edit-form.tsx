"use client";

import { useActionState } from "react";
import { setCardArchived, updateCard } from "@/app/decks/actions";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/field";

type Card = {
  id: string;
  front: string;
  back: string;
  example: string | null;
  note: string | null;
  tags: string[];
  archived: boolean;
};

export function CardEditForm({
  deck,
  card,
}: {
  deck: { id: string; source_lang: string; target_lang: string };
  card: Card;
}) {
  const [state, action] = useActionState(updateCard, undefined);
  const v = state?.values;

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="deckId" value={deck.id} />
        <input type="hidden" name="cardId" value={card.id} />
        {state?.error ? <Alert>{state.error}</Alert> : null}
        <Field
          label="Ön yüz (kelime)"
          id="front"
          required
          maxLength={200}
          lang={deck.source_lang}
          defaultValue={v?.front ?? card.front}
        />
        <Field
          label="Arka yüz (anlam)"
          id="back"
          required
          maxLength={500}
          lang={deck.target_lang}
          defaultValue={v?.back ?? card.back}
        />
        <TextArea
          label="Örnek cümle"
          id="example"
          lang={deck.source_lang}
          defaultValue={v?.example ?? card.example ?? ""}
        />
        <TextArea label="Not" id="note" defaultValue={v?.note ?? card.note ?? ""} />
        <Field
          label="Etiketler"
          id="tags"
          hint="Virgülle ayır: fiil, A2"
          defaultValue={v?.tags ?? card.tags.join(", ")}
        />
        <SubmitButton pendingText="Kaydediliyor…">Kaydet</SubmitButton>
      </form>

      <form action={setCardArchived} className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <input type="hidden" name="deckId" value={deck.id} />
        <input type="hidden" name="cardId" value={card.id} />
        <input type="hidden" name="archived" value={String(!card.archived)} />
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          {card.archived
            ? "Bu kart arşivde; çalışma kuyruğuna girmiyor."
            : "Arşivlenen kart silinmez, sadece çalışma kuyruğundan çıkar."}
        </p>
        <button type="submit" className={buttonClass("secondary")}>
          {card.archived ? "Arşivden çıkar" : "Kartı arşivle"}
        </button>
      </form>
    </div>
  );
}

function TextArea({
  label,
  id,
  defaultValue,
  lang,
}: {
  label: string;
  id: string;
  defaultValue: string;
  lang?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        rows={3}
        maxLength={1000}
        lang={lang}
        defaultValue={defaultValue}
        className={`${inputClass} py-2`}
      />
    </div>
  );
}
