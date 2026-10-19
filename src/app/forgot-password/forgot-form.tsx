"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { requestPasswordReset } from "./actions";

export function ForgotForm() {
  const [state, action] = useActionState(requestPasswordReset, undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field
        label="E-posta"
        id="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state?.values?.email}
      />
      <SubmitButton pendingText="Gönderiliyor…">Sıfırlama bağlantısı gönder</SubmitButton>
      <Link
        href="/login"
        className="self-center rounded-md px-2 py-2 text-sm text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-300"
      >
        Girişe dön
      </Link>
    </form>
  );
}
