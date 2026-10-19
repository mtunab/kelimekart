/**
 * "Gün" kavramı: kullanıcının saat dilimine göre, yerel saat 04:00'te başlar.
 * (Gece 02:00'de çalışan biri hâlâ "dün" sayılır.) Veritabanındaki
 * `public.local_study_day` ile aynı kural. Hepsi saf fonksiyon.
 */

export const DAY_START_HOUR = 4;
export const DEFAULT_TIMEZONE = "Europe/Istanbul";

/** Gün, "YYYY-MM-DD" biçiminde. */
export type StudyDay = string;

function partsInZone(at: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(at).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function toDayString(year: number, month: number, day: number): StudyDay {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Verilen andaki çalışma günü (kullanıcının saat dilimine göre, 04:00 sınırıyla). */
export function studyDay(at: Date, timeZone: string): StudyDay {
  // Önce yerel saate çevir, sonra yerel saatten 4 saat geri git. (Önce 4 saat çıkarmak
  // yaz saati geçiş günlerinde yanlış sonuç verir.)
  const { year, month, day, hour } = partsInZone(at, timeZone);
  const today = toDayString(year, month, day);
  return hour < DAY_START_HOUR ? addDays(today, -1) : today;
}

/** Bir güne gün ekler/çıkarır (saat diliminden bağımsız, takvim aritmetiği). */
export function addDays(day: StudyDay, amount: number): StudyDay {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + amount));
  return toDayString(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** Saat diliminin verilen andaki UTC farkı (dakika). İstanbul için +180. */
function offsetMinutes(at: Date, timeZone: string): number {
  const p = partsInZone(at, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

/** Çalışma gününün başladığı an (yerel 04:00) — UTC olarak. */
export function studyDayStart(day: StudyDay, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const naiveUtc = Date.UTC(y, m - 1, d, DAY_START_HOUR, 0, 0);
  // Yaz saati geçişlerinde doğru farkı bulmak için iki kez düzelt.
  let guess = naiveUtc - offsetMinutes(new Date(naiveUtc), timeZone) * 60_000;
  guess = naiveUtc - offsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess);
}

/** Çalışma gününün [başlangıç, bitiş) aralığı. */
export function studyDayRange(day: StudyDay, timeZone: string): { start: Date; end: Date } {
  return { start: studyDayStart(day, timeZone), end: studyDayStart(addDays(day, 1), timeZone) };
}

export type Streak = { count: number; lastDay: StudyDay | null };

/** Bugün bir tekrar yapıldığında serinin yeni hali. */
export function streakAfterReview(previous: Streak, today: StudyDay): Streak {
  if (previous.lastDay === today) return previous;
  if (previous.lastDay === addDays(today, -1)) return { count: previous.count + 1, lastDay: today };
  return { count: 1, lastDay: today };
}

/** Ekranda gösterilecek seri: dün veya bugün çalışılmadıysa seri bozulmuştur (0). */
export function currentStreak(stored: Streak, today: StudyDay): number {
  if (stored.lastDay === today || stored.lastDay === addDays(today, -1)) return stored.count;
  return 0;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
