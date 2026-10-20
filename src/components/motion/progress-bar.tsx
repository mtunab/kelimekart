"use client";

import { m } from "motion/react";

/** Dolarken kayarak büyüyen, kalın kenarlı ilerleme çubuğu. Hedefe ulaşınca pembeye döner. */
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
      className={`border-ink bg-surface h-4 overflow-hidden rounded-full border-[2.5px] ${className}`}
    >
      <m.div
        className={`h-full ${percent > 0 && percent < 100 ? "border-ink border-r-[2.5px]" : ""} ${percent >= 100 ? "bg-pink" : "bg-teal"}`}
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 22 }}
      />
    </div>
  );
}
