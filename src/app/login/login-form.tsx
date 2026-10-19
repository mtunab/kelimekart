"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { signIn } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state?.error ? <Alert>{state.error}</Alert> : null}
      <Field
        label="E-posta"
        id="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state?.values?.email}
      />
      <Field label="Şifre" id="password" type="password" autoComplete="current-password" required />
      <SubmitButton pendingText="Giriş yapılıyor…">Giriş yap</SubmitButton>
      <Link
        href="/forgot-password"
        className="self-center rounded-md px-2 py-2 text-sm text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-300"
      >
        Şifremi unuttum
      </Link>
    </form>
  );
}
