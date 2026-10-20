import type { InputHTMLAttributes } from "react";

export const inputClass =
  "min-h-11 w-full rounded-xl border-[2.5px] border-ink bg-surface px-3 text-base font-medium text-ink placeholder:text-ink-soft/70 focus-visible:shadow-hard-sm";

export const labelClass = "text-sm font-bold text-ink";

export function Field({
  label,
  id,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} name={id} className={inputClass} {...props} />
      {hint ? <p className="text-ink-soft text-sm">{hint}</p> : null}
    </div>
  );
}
