/**
 * FSRS ayarlarının tek yeri.
 * - Hedef hatırlama oranı %90: bir kart vadesi geldiğinde %90 ihtimalle hatırlanmalı.
 * - Bulanıklaştırma (fuzz) açık: aynı gün eklenen kartların hepsi aynı güne yığılmasın.
 * - İlk adımlar DuoCards'a benzer (onun merdiveni: 90 sn → 30 dk → 12 sa → 2 gün → …).
 *   Kütüphane yalnızca tam dakika kabul ettiği için 90 sn yerine 2 dk. Yeni kelimede:
 *   yanlış → 2 dk, doğru → 30 dk → 12 sa → sonrasını FSRS kişiye göre (gün/hafta) hesaplar.
 *   Unutulan eski kelimede: yanlış → 2 dk, doğru → 30 dk → yeniden FSRS.
 */
export const SRS_CONFIG = {
  requestRetention: 0.9,
  enableFuzz: true,
  maximumIntervalDays: 3650,
  learningSteps: ["2m", "30m", "12h"],
  relearningSteps: ["2m", "30m"],
} as const;
