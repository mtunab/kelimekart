import { describe, expect, it } from "vitest";
import {
  GRADES,
  isGrade,
  LADDER_MS,
  levelOf,
  MAX_LEVEL,
  Rating,
  RETRY_MS,
  review,
  State,
  type ProgressFields,
} from "@/lib/srs";

const T0 = new Date("2026-03-01T09:00:00.000Z");
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Cevaptan sonra kartın kaç ms bekleyeceği. */
const wait = (row: ProgressFields, answeredAt: Date) => Date.parse(row.due) - answeredAt.getTime();

/** Kartı her seferinde tam zamanında "bildim" diyerek istenen basamağa çıkarır. */
function climb(level: number): { row: ProgressFields; at: Date } {
  let row = review(null, Rating.Good, T0);
  let at = new Date(row.due);
  while (levelOf(row) < level) {
    row = review(row, Rating.Good, at);
    at = new Date(row.due);
  }
  return { row, at };
}

describe("DuoCards merdiveni: süreler", () => {
  it("süreler DuoCards'ın yayımladığı sırayla aynı", () => {
    expect([...LADDER_MS]).toEqual([
      90 * SECOND,
      30 * MINUTE,
      12 * HOUR,
      2 * DAY,
      14 * DAY,
      60 * DAY,
    ]);
    expect(MAX_LEVEL).toBe(6);
    expect(RETRY_MS).toBe(90 * SECOND);
  });

  it("hep bilinen yeni kart: 90 sn → 30 dk → 12 sa → 2 gün → 2 hafta → 2 ay", () => {
    let row: ProgressFields | null = null;
    let at = T0;
    const waits: number[] = [];
    for (let i = 0; i < 6; i++) {
      row = review(row, Rating.Good, at);
      waits.push(wait(row, at));
      expect(levelOf(row)).toBe(i + 1);
      at = new Date(row.due);
    }
    expect(waits).toEqual([...LADDER_MS]);
  });

  it("en üst basamaktaki kart bilindikçe 2 ayda bir gelir", () => {
    const { row, at } = climb(MAX_LEVEL);
    const next = review(row, Rating.Good, at);
    expect(levelOf(next)).toBe(MAX_LEVEL);
    expect(wait(next, at)).toBe(60 * DAY);
  });
});

describe("DuoCards merdiveni: bilinmeyen kart", () => {
  it("yeni kart bilinmezse 90 sn sonra tekrar sorulur ve en alt basamakta kalır", () => {
    const row = review(null, Rating.Again, T0);
    expect(wait(row, T0)).toBe(90 * SECOND);
    expect(levelOf(row)).toBe(0);
    expect(row.state).toBe(State.Learning);
  });

  it.each([1, 2, 3, 4, 5, 6])(
    "%i. basamaktaki kart bilinmezse HER ZAMAN 90 sn sonra gelir ve iki basamak iner",
    (level) => {
      const { row, at } = climb(level);
      const next = review(row, Rating.Again, at);
      expect(wait(next, at)).toBe(90 * SECOND);
      expect(levelOf(next)).toBe(Math.max(0, level - 2));
      expect(next.state).toBe(State.Learning);
    },
  );

  it("bilinmeyen kart günler sonraya asla planlanmaz (geç kalınmış olsa da)", () => {
    const { row, at } = climb(6);
    const late = new Date(at.getTime() + 40 * DAY);
    expect(wait(review(row, Rating.Again, late), late)).toBe(90 * SECOND);
  });

  it("bilinmeyip sonra bilinen kart indiği basamaktan devam eder", () => {
    // 4. basamak (2 gün) → bilinmedi → 2. basamak; bilindi → 3. basamak (12 sa); → 4 (2 gün).
    const { row, at } = climb(4);
    const failed = review(row, Rating.Again, at);
    const back = new Date(failed.due);
    const known = review(failed, Rating.Good, back);
    expect(levelOf(known)).toBe(3);
    expect(wait(known, back)).toBe(12 * HOUR);
    const again = review(known, Rating.Good, new Date(known.due));
    expect(wait(again, new Date(known.due))).toBe(2 * DAY);
  });

  it("günlerce aralıktaki kartın unutulması 'unutma' sayılır; kısa aralıktaki sayılmaz", () => {
    const long = climb(4);
    expect(review(long.row, Rating.Again, long.at).lapses).toBe(1);
    const short = climb(2);
    expect(review(short.row, Rating.Again, short.at).lapses).toBe(0);
  });
});

describe("DuoCards merdiveni: zor ve çok kolay (klavye)", () => {
  it("zor: basamak değişmez, aynı süre bir kez daha beklenir", () => {
    const { row, at } = climb(3);
    const next = review(row, Rating.Hard, at);
    expect(levelOf(next)).toBe(3);
    expect(wait(next, at)).toBe(12 * HOUR);
    expect(wait(review(null, Rating.Hard, T0), T0)).toBe(90 * SECOND);
  });

  it("çok kolay: iki basamak çıkar, tepeyi aşmaz", () => {
    const row = review(null, Rating.Easy, T0);
    expect(levelOf(row)).toBe(2);
    expect(wait(row, T0)).toBe(30 * MINUTE);
    const top = climb(5);
    expect(levelOf(review(top.row, Rating.Easy, top.at))).toBe(MAX_LEVEL);
  });

  it("yeni kartta bilmedim ≤ zor < bildim < çok kolay sırasıyla daha uzak zaman verir", () => {
    const dues = GRADES.map((grade) => Date.parse(review(null, grade, T0).due));
    expect(dues[0]!).toBeLessThanOrEqual(dues[1]!);
    expect(dues[1]!).toBeLessThanOrEqual(dues[2]!);
    expect(dues[2]!).toBeLessThan(dues[3]!);
  });
});

describe("DuoCards merdiveni: erken tekrar (ek alıştırma)", () => {
  it("zamanından günler önce bilinen kart basamak atlamaz, zamanı değişmez", () => {
    const { row, at } = climb(4); // 2 gün bekliyor
    const early = new Date(at.getTime() - DAY);
    const next = review(row, Rating.Good, early);
    expect(levelOf(next)).toBe(4);
    expect(next.due).toBe(row.due);
    expect(next.state).toBe(row.state);
    expect(next.scheduled_days).toBe(row.scheduled_days);
    expect(next.reps).toBe(row.reps + 1);
  });

  it("erken tekrarda bilinmeyen kart yine iner ve 90 sn sonra gelir", () => {
    const { row, at } = climb(4);
    const early = new Date(at.getTime() - DAY);
    const next = review(row, Rating.Again, early);
    expect(levelOf(next)).toBe(2);
    expect(wait(next, early)).toBe(90 * SECOND);
  });

  it("birkaç dakikalık saat farkı erken sayılmaz", () => {
    const { row, at } = climb(2); // 30 dk bekliyor
    const slightlyEarly = new Date(at.getTime() - 2 * MINUTE);
    expect(levelOf(review(row, Rating.Good, slightlyEarly))).toBe(3);
  });

  it("geç kalınan kart da normal işlenir", () => {
    const { row, at } = climb(4);
    const late = new Date(at.getTime() + 10 * DAY);
    const next = review(row, Rating.Good, late);
    expect(levelOf(next)).toBe(5);
    expect(wait(next, late)).toBe(14 * DAY);
  });
});

describe("satır alanları", () => {
  it.each(GRADES)("puan %i sonrası tekrar sayısı 1 artar, son tekrar zamanı yazılır", (grade) => {
    const row = review(null, grade, T0);
    expect(row.reps).toBe(1);
    expect(row.last_review).toBe(T0.toISOString());
    expect(Date.parse(row.due)).toBeGreaterThan(T0.getTime());
  });

  it("durum: bir günden kısa bekleyen 1, gün ve üzeri bekleyen 2; gün sayısı doğru", () => {
    expect(climb(3).row).toMatchObject({ state: State.Learning, scheduled_days: 0 });
    expect(climb(4).row).toMatchObject({ state: State.Review, scheduled_days: 2 });
    expect(climb(5).row).toMatchObject({ state: State.Review, scheduled_days: 14 });
    expect(climb(6).row).toMatchObject({ state: State.Review, scheduled_days: 60 });
  });

  it("tarihler UTC ISO metni; veritabanından gelen +00:00 biçimi de okunur", () => {
    const row = review(null, Rating.Good, T0);
    expect(row.due).toMatch(/Z$/);
    const fromDb = { ...row, due: row.due.replace("Z", "+00:00") };
    const next = review(fromDb, Rating.Good, new Date(row.due));
    expect(wait(next, new Date(row.due))).toBe(30 * MINUTE);
  });

  it("satırdaki fazladan alanlar (sürüm, kullanıcı) çıktıya taşınmaz", () => {
    const row = { ...review(null, Rating.Good, T0), version: 7, user_id: "x" };
    const next = review(row, Rating.Good, new Date(row.due));
    expect(Object.keys(next).sort()).toEqual(
      [
        "difficulty",
        "due",
        "elapsed_days",
        "lapses",
        "last_review",
        "learning_steps",
        "reps",
        "scheduled_days",
        "stability",
        "state",
      ].sort(),
    );
  });

  it("aynı girdiyle aynı sonucu verir (saf fonksiyon)", () => {
    const { row, at } = climb(3);
    expect(review(row, Rating.Good, at)).toEqual(review(row, Rating.Good, at));
  });

  it("bozuk basamak değeri güvenli aralığa çekilir", () => {
    const row = review(null, Rating.Good, T0);
    expect(levelOf({ ...row, learning_steps: 99 })).toBe(MAX_LEVEL);
    expect(levelOf({ ...row, learning_steps: -3 })).toBe(0);
    expect(levelOf(null)).toBe(0);
  });

  it("geçerli puanları tanır", () => {
    expect([0, 1, 2, 3, 4, 5, "3"].map(isGrade)).toEqual([
      false,
      true,
      true,
      true,
      true,
      false,
      false,
    ]);
  });
});
