import type { InputHTMLAttributes } from "react";

export const inputClass =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus-visible:border-indigo-500 focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function Field({
  label,
  id,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input id={id} name={id} className={inputClass} {...props} />
      {hint ? <p className="text-sm text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}
