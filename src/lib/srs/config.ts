/**
 * FSRS ayarlarının tek yeri.
 * - Hedef hatırlama oranı %90: bir kart vadesi geldiğinde %90 ihtimalle hatırlanmalı.
 * - Bulanıklaştırma (fuzz) açık: aynı gün eklenen kartların hepsi aynı güne yığılmasın.
 */
export const SRS_CONFIG = {
  requestRetention: 0.9,
  enableFuzz: true,
  maximumIntervalDays: 3650,
} as const;
