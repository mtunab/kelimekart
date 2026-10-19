import { describe, expect, it } from "vitest";
import {
  addDays,
  currentStreak,
  isValidTimeZone,
  streakAfterReview,
  studyDay,
  studyDayRange,
  studyDayStart,
} from "@/lib/dates";

const IST = "Europe/Istanbul"; // UTC+3, yaz saati yok
const BERLIN = "Europe/Berlin"; // yaz saati var
const NY = "America/New_York";
const TOKYO = "Asia/Tokyo";

describe("çalışma günü (04:00 sınırı)", () => {
  it("İstanbul'da 03:59 hâlâ önceki gün, 04:00 yeni gün", () => {
    // 03:59 İstanbul = 00:59 UTC
    expect(studyDay(new Date("2026-05-10T00:59:00Z"), IST)).toBe("2026-05-09");
    // 04:00 İstanbul = 01:00 UTC
    expect(studyDay(new Date("2026-05-10T01:00:00Z"), IST)).toBe("2026-05-10");
  });

  it("gece yarısı geçse bile 04:00'e kadar gün değişmez", () => {
    // 23:30 ve 02:30 İstanbul aynı çalışma günü
    expect(studyDay(new Date("2026-05-09T20:30:00Z"), IST)).toBe("2026-05-09");
    expect(studyDay(new Date("2026-05-09T23:30:00Z"), IST)).toBe("2026-05-09");
  });

  it("aynı an farklı saat dilimlerinde farklı gün olabilir", () => {
    const at = new Date("2026-05-10T02:00:00Z");
    // New York (yazın UTC-4): 04:00 yerel = 08:00 UTC
    expect(studyDay(new Date("2026-05-10T07:59:00Z"), NY)).toBe("2026-05-09");
    expect(studyDay(new Date("2026-05-10T08:00:00Z"), NY)).toBe("2026-05-10");
    expect(studyDay(at, IST)).toBe("2026-05-10"); // 05:00
    expect(studyDay(at, NY)).toBe("2026-05-09"); // 9 Mayıs 22:00 → 4 saat geri 18:00 → 9 Mayıs
    expect(studyDay(at, TOKYO)).toBe("2026-05-10"); // 11:00
  });

  it("UTC'ye göre değil kullanıcı saat dilimine göre", () => {
    // UTC'de 10 Mayıs 01:30; Tokyo'da 10:30 → 10 Mayıs; New York'ta 9 Mayıs 21:30 → 9 Mayıs
    const at = new Date("2026-05-10T01:30:00Z");
    expect(studyDay(at, TOKYO)).toBe("2026-05-10");
    expect(studyDay(at, NY)).toBe("2026-05-09");
  });

  it("yıl dönümünde doğru", () => {
    expect(studyDay(new Date("2026-12-31T22:00:00Z"), IST)).toBe("2026-12-31"); // 01:00 1 Ocak
    expect(studyDay(new Date("2027-01-01T01:00:00Z"), IST)).toBe("2027-01-01"); // 04:00
  });
});

describe("gün başlangıcı ve aralığı", () => {
  it("İstanbul günü 01:00 UTC'de başlar", () => {
    expect(studyDayStart("2026-05-10", IST).toISOString()).toBe("2026-05-10T01:00:00.000Z");
  });

  it("Berlin yaz saati geçişlerinde 04:00 yerel saatini korur", () => {
    // 29 Mart 2026: Berlin 02:00'de yaz saatine geçer (UTC+1 → UTC+2)
    expect(studyDayStart("2026-03-28", BERLIN).toISOString()).toBe("2026-03-28T03:00:00.000Z");
    expect(studyDayStart("2026-03-29", BERLIN).toISOString()).toBe("2026-03-29T02:00:00.000Z");
    // 25 Ekim 2026: kış saatine dönüş (UTC+2 → UTC+1)
    expect(studyDayStart("2026-10-25", BERLIN).toISOString()).toBe("2026-10-25T03:00:00.000Z");
  });

  it("yaz saati geçiş sabahı: yerel 04:00 yeni gündür (03:59 değil)", () => {
    // 29 Mart 2026 Berlin: 01:00 UTC'de saat 02:00 → 03:00 olur. Yerel 04:00 = 02:00 UTC.
    expect(studyDay(new Date("2026-03-29T01:59:00Z"), BERLIN)).toBe("2026-03-28");
    expect(studyDay(new Date("2026-03-29T02:00:00Z"), BERLIN)).toBe("2026-03-29");
    // 25 Ekim 2026 Berlin: kış saatine dönüş. Yerel 04:00 = 03:00 UTC.
    expect(studyDay(new Date("2026-10-25T02:59:00Z"), BERLIN)).toBe("2026-10-24");
    expect(studyDay(new Date("2026-10-25T03:00:00Z"), BERLIN)).toBe("2026-10-25");
  });

  it("yaz saatine geçilen gün 23 saat sürer", () => {
    const { start, end } = studyDayRange("2026-03-28", BERLIN);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("gün başlangıcı o günün içinde, bir saniye öncesi önceki günde", () => {
    for (const tz of [IST, BERLIN, NY, TOKYO]) {
      for (const day of ["2026-07-15", "2026-03-29", "2026-10-25", "2026-03-08", "2026-11-01"]) {
        const start = studyDayStart(day, tz);
        expect(studyDay(start, tz)).toBe(day);
        expect(studyDay(new Date(start.getTime() - 1000), tz)).toBe(addDays(day, -1));
      }
    }
  });
});

describe("gün aritmetiği", () => {
  it("ay ve yıl sınırlarını geçer", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("seri (streak)", () => {
  it("ilk tekrar seriyi 1 yapar", () => {
    expect(streakAfterReview({ count: 0, lastDay: null }, "2026-05-10")).toEqual({
      count: 1,
      lastDay: "2026-05-10",
    });
  });

  it("aynı gün ikinci tekrar seriyi değiştirmez", () => {
    const s = { count: 4, lastDay: "2026-05-10" };
    expect(streakAfterReview(s, "2026-05-10")).toEqual(s);
  });

  it("ertesi gün devam eder", () => {
    expect(streakAfterReview({ count: 4, lastDay: "2026-05-09" }, "2026-05-10")).toEqual({
      count: 5,
      lastDay: "2026-05-10",
    });
  });

  it("bir gün atlanırsa sıfırdan başlar", () => {
    expect(streakAfterReview({ count: 9, lastDay: "2026-05-08" }, "2026-05-10")).toEqual({
      count: 1,
      lastDay: "2026-05-10",
    });
  });

  it("ekranda: dün çalıştıysa seri sürer, bugün henüz çalışmasa bile", () => {
    expect(currentStreak({ count: 5, lastDay: "2026-05-09" }, "2026-05-10")).toBe(5);
    expect(currentStreak({ count: 5, lastDay: "2026-05-10" }, "2026-05-10")).toBe(5);
    expect(currentStreak({ count: 5, lastDay: "2026-05-08" }, "2026-05-10")).toBe(0);
    expect(currentStreak({ count: 0, lastDay: null }, "2026-05-10")).toBe(0);
  });

  it("gece 02:00 tekrarı önceki günü sürdürür (04:00 sınırı)", () => {
    const yesterday = { count: 3, lastDay: "2026-05-09" };
    const lateNight = studyDay(new Date("2026-05-09T23:00:00Z"), IST); // 02:00 İstanbul, 10 Mayıs
    expect(lateNight).toBe("2026-05-09");
    expect(streakAfterReview(yesterday, lateNight)).toEqual(yesterday);
  });
});

describe("saat dilimi doğrulama", () => {
  it("geçerli ve geçersiz adları ayırır", () => {
    expect(isValidTimeZone("Europe/Istanbul")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
