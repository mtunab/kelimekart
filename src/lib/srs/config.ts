/**
 * Tekrar kurallarının tek yeri: basamaklı (Leitner benzeri) sistem, sınav hazırlığına göre sık.
 *
 * Her kartın bir basamağı var (0 = en alt). Kart bilinince bir basamak çıkar ve o basamağın
 * süresi kadar bekler; bilinmeyince EN BAŞA döner ve 20 sn sonra tekrar sorulur.
 *
 *   basamak:   1      2      3      4     5      6      7        8        9
 *   bekleme:  20 sn  3 dk   30 dk  4 sa  1 gün  3 gün  1 hafta  3 hafta  2 ay
 *
 * İlk iki basamak aynı oturumda sorulur: yeni kelime oturumdan çıkmadan üç kez bilinmeli.
 * En üst basamaktaki kart bilindikçe 2 ayda bir gelmeye devam eder.
 * (2026-11-13: DuoCards'ın 90 sn → 30 dk → 12 sa → 2 gün → 2 hafta → 2 ay merdiveninden
 * Tuna'nın isteğiyle vize hazırlığına göre sıklaştırıldı.)
 */
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
export const DAY_MS = 24 * HOUR;

/** LADDER_MS[i] = (i + 1). basamağa çıkan kartın bekleme süresi. */
export const LADDER_MS = [
  20 * SECOND,
  3 * MINUTE,
  30 * MINUTE,
  4 * HOUR,
  1 * DAY_MS,
  3 * DAY_MS,
  7 * DAY_MS,
  21 * DAY_MS,
  60 * DAY_MS,
] as const;

export const MAX_LEVEL = LADDER_MS.length;

/** Bilinmeyen kart bu kadar sonra tekrar sorulur. */
export const RETRY_MS = 20 * SECOND;

/**
 * Kart zamanından bu kadar önce cevaplanırsa "erken tekrar" sayılmaz (saat farkı payı).
 * Daha erken bilinirse basamak atlamaz: serbest tekrar takvimi öne çekmesin.
 */
export const EARLY_GRACE_MS = 5 * MINUTE;
