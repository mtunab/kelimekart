"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { PASSWORD_MIN } from "@/lib/validation/auth";
import { setNewPassword } from "./actions";

export function ResetForm() {
  const [state, action] = useActionState(setNewPassword, undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field
        label="Yeni şifre"
        id="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        required
        hint={`En az ${PASSWORD_MIN} karakter.`}
      />
      <Field
        label="Yeni şifre (tekrar)"
        id="confirm"
        type="password"
        autoComplete="new-password"
        required
      />
      <SubmitButton pendingText="Kaydediliyor…">Şifreyi kaydet</SubmitButton>
    </form>
  );
}
