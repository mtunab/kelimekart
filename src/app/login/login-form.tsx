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
        label="Username"
        id="username"
        type="text"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        defaultValue={state?.values?.username}
      />
      <Field
        label="Password"
        id="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <SubmitButton pendingText="Logging in…">Log in</SubmitButton>
      <Link
        href="/forgot-password"
        className="self-center rounded-md px-2 py-2 text-sm text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-300"
      >
        Forgot password?
      </Link>
    </form>
  );
}
