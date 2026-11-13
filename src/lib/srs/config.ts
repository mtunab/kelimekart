/**
 * Tekrar kurallarının tek yeri: DuoCards'ın basamaklı (Leitner benzeri) sistemi.
 *
 * Her kartın bir basamağı var (0 = en alt). Kart bilinince bir basamak çıkar ve o basamağın
 * süresi kadar bekler; bilinmeyince iki basamak iner ve hemen (90 sn sonra) tekrar sorulur.
 *
 *   basamak:   1       2       3       4       5        6
 *   bekleme:  90 sn   30 dk   12 sa   2 gün   2 hafta  2 ay
 *
 * Kaynak: DuoCards'ın kendi yardım sayfası ("How does DuoCards' algorithm work?").
 * En üst basamaktaki kart bilindikçe 2 ayda bir gelmeye devam eder.
 */
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
export const DAY_MS = 24 * HOUR;

/** LADDER_MS[i] = (i + 1). basamağa çıkan kartın bekleme süresi. */
export const LADDER_MS = [
  90 * SECOND,
  30 * MINUTE,
  12 * HOUR,
  2 * DAY_MS,
  14 * DAY_MS,
  60 * DAY_MS,
] as const;

export const MAX_LEVEL = LADDER_MS.length;

/** Bilinmeyen kart bu kadar sonra tekrar sorulur. */
export const RETRY_MS = 90 * SECOND;

/** Bilinmeyen kart kaç basamak iner ("a level or two"). */
export const DROP_LEVELS = 2;

/**
 * Kart zamanından bu kadar önce cevaplanırsa "erken tekrar" sayılmaz (saat farkı payı).
 * Daha erken bilinirse basamak atlamaz: ek alıştırma takvimi öne çekmesin.
 */
export const EARLY_GRACE_MS = 5 * MINUTE;
