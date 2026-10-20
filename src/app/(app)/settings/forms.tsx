"use client";

import { useActionState, useRef } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select";
import { PASSWORD_MIN } from "@/lib/validation/auth";
import { changePassword, updateProfile } from "./actions";

export function ProfileForm({
  profile,
  zones,
}: {
  profile: {
    display_name: string;
    timezone: string;
    daily_new_limit: number;
    daily_goal_reviews: number;
  };
  zones: string[];
}) {
  const [state, action] = useActionState(updateProfile, undefined);
  const v = state?.values;

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field
        label="Display name"
        id="display_name"
        maxLength={40}
        required
        defaultValue={v?.display_name ?? profile.display_name}
        hint="This name appears on the group board."
      />
      <SelectField
        label="Time zone"
        id="timezone"
        options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))}
        defaultValue={v?.timezone ?? profile.timezone}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="New cards per day"
          id="daily_new_limit"
          type="number"
          inputMode="numeric"
          min={0}
          max={200}
          defaultValue={v?.daily_new_limit ?? String(profile.daily_new_limit)}
        />
        <Field
          label="Daily review goal"
          id="daily_goal_reviews"
          type="number"
          inputMode="numeric"
          min={1}
          max={1000}
          defaultValue={v?.daily_goal_reviews ?? String(profile.daily_goal_reviews)}
        />
      </div>
      <p className="text-ink-soft text-sm">A new day starts at 4:00 AM in your time zone.</p>
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState(
    async (prev: Parameters<typeof changePassword>[0], data: FormData) => {
      const result = await changePassword(prev, data);
      if (result?.success) formRef.current?.reset();
      return result;
    },
    undefined,
  );

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4" noValidate>
      {state?.error ? <Alert>{state.error}</Alert> : null}
      {state?.success ? <Alert tone="success">{state.success}</Alert> : null}
      <Field
        label="New password"
        id="password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        hint={`At least ${PASSWORD_MIN} characters.`}
      />
      <Field
        label="Confirm new password"
        id="confirm"
        type="password"
        autoComplete="new-password"
      />
      <SubmitButton pendingText="Changing…">Change password</SubmitButton>
    </form>
  );
}
