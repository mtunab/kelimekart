"use client";

import { m } from "motion/react";

/** Dolarken kayarak büyüyen ilerleme çubuğu. */
export function ProgressBar({
  value,
  max,
  label,
  className = "",
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const percent = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      className={`h-2.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800 ${className}`}
    >
      <m.div
        className={`h-full rounded-full ${percent >= 100 ? "bg-green-500" : "bg-indigo-600 dark:bg-indigo-500"}`}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      />
    </div>
  );
}
