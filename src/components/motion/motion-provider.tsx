"use client";

import { domMax, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Animasyon altyapısı: `m.*` bileşenleri bu sağlayıcıdan özellikleri alır (LazyMotion, daha küçük paket).
 * `reducedMotion="user"`: cihazda "hareketi azalt" açıksa kaymalar/dönmeler kapanır, sadece solma kalır.
 * `domMax` kaydırma (drag) ve layout animasyonlarını da içerir.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
