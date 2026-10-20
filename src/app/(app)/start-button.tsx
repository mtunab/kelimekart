"use client";

import { m } from "motion/react";
import Link from "next/link";

const MotionLink = m.create(Link);

/** Büyük "Start studying" düğmesi: hafif nefes alma, üstüne gelince/dokununca tepki. */
export function StartButton({ href, count }: { href: string; count: number }) {
  return (
    <MotionLink
      href={href}
      className="relative flex min-h-16 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-indigo-600 px-6 text-lg font-semibold text-white shadow-lg shadow-indigo-600/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:bg-indigo-500"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      animate={{
        boxShadow: [
          "0 10px 24px -8px rgb(79 70 229 / 0.35)",
          "0 14px 32px -6px rgb(79 70 229 / 0.55)",
          "0 10px 24px -8px rgb(79 70 229 / 0.35)",
        ],
      }}
      transition={{ boxShadow: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } }}
    >
      Start studying
      <span className="rounded-full bg-white/20 px-2 py-0.5 text-sm font-medium">{count}</span>
    </MotionLink>
  );
}
