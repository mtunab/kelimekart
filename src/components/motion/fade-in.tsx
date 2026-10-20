"use client";

import { m } from "motion/react";
import type { ReactNode } from "react";

/** İçeriği aşağıdan yumuşakça getirir; `index` ile listelerde sırayla (kademeli) belirir. */
export function FadeIn({
  children,
  index = 0,
  className,
  as = "div",
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  as?: "div" | "li" | "section";
}) {
  const Component = as === "li" ? m.li : as === "section" ? m.section : m.div;
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 32,
        delay: Math.min(index, 12) * 0.045,
      }}
    >
      {children}
    </Component>
  );
}
