"use client";

import { m } from "motion/react";
import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

/** Büyük sarı "Start studying" düğmesi: basınca gölgesine gömülür, ok hafifçe ileri itilir. */
export function StartButton({ href, count }: { href: string; count: number }) {
  return (
    <Link
      href={href}
      className="press border-ink bg-yellow text-on-accent flex min-h-16 w-full items-center justify-between gap-2 rounded-xl border-[3px] px-5 text-xl font-bold"
    >
      <span className="flex items-center gap-3">
        Start studying
        <span className="border-ink bg-surface text-ink rounded-full border-2 px-2.5 py-0.5 text-base">
          {count}
        </span>
      </span>
      <m.span
        className="flex"
        animate={{ x: [0, 5, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <ArrowRightIcon size={26} strokeWidth={2.8} />
      </m.span>
    </Link>
  );
}
