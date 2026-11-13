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
import { LEARN_AHEAD_MS } from "@/lib/study-queue";

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

describe("merdiven: süreler", () => {
  it("süreler sınav hazırlığına göre sık: 20 sn → 3 dk → 30 dk → 4 sa → 1 → 3 → 7 → 21 → 60 gün", () => {
    expect([...LADDER_MS]).toEqual([
      20 * SECOND,
      3 * MINUTE,
      30 * MINUTE,
      4 * HOUR,
      1 * DAY,
      3 * DAY,
      7 * DAY,
      21 * DAY,
      60 * DAY,
    ]);
    expect(MAX_LEVEL).toBe(9);
    expect(RETRY_MS).toBe(20 * SECOND);
  });

  it("hep bilinen yeni kart merdiveni sırayla çıkar", () => {
    let row: ProgressFields | null = null;
    let at = T0;
    const waits: number[] = [];
    for (let i = 0; i < MAX_LEVEL; i++) {
      row = review(row, Rating.Good, at);
      waits.push(wait(row, at));
      expect(levelOf(row)).toBe(i + 1);
      at = new Date(row.due);
    }
    expect(waits).toEqual([...LADDER_MS]);
  });

  it("yeni kelime oturumdan çıkmadan üç kez bilinmeli (20 sn ve 3 dk oturumda, 30 dk dışarıda)", () => {
    const first = review(null, Rating.Good, T0);
    expect(wait(first, T0)).toBeLessThanOrEqual(LEARN_AHEAD_MS);
    const second = review(first, Rating.Good, new Date(first.due));
    expect(wait(second, new Date(first.due))).toBeLessThanOrEqual(LEARN_AHEAD_MS);
    const third = review(second, Rating.Good, new Date(second.due));
    expect(wait(third, new Date(second.due))).toBeGreaterThan(LEARN_AHEAD_MS);
  });

  it("en üst basamaktaki kart bilindikçe 2 ayda bir gelir", () => {
    const { row, at } = climb(MAX_LEVEL);
    const next = review(row, Rating.Good, at);
    expect(levelOf(next)).toBe(MAX_LEVEL);
    expect(wait(next, at)).toBe(60 * DAY);
  });
});

describe("merdiven: bilinmeyen kart", () => {
  it("yeni kart bilinmezse 20 sn sonra tekrar sorulur ve en alt basamakta kalır", () => {
    const row = review(null, Rating.Again, T0);
    expect(wait(row, T0)).toBe(20 * SECOND);
    expect(levelOf(row)).toBe(0);
    expect(row.state).toBe(State.Learning);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
    "%i. basamaktaki kart bilinmezse en başa döner ve 20 sn sonra gelir",
    (level) => {
      const { row, at } = climb(level);
      const next = review(row, Rating.Again, at);
      expect(wait(next, at)).toBe(20 * SECOND);
      expect(levelOf(next)).toBe(0);
      expect(next.state).toBe(State.Learning);
    },
  );

  it("bilinmeyen kart günler sonraya asla planlanmaz (geç kalınmış olsa da)", () => {
    const { row, at } = climb(9);
    const late = new Date(at.getTime() + 40 * DAY);
    expect(wait(review(row, Rating.Again, late), late)).toBe(20 * SECOND);
  });

  it("bilinmeyip sonra bilinen kart merdiveni baştan çıkar: 20 sn → 3 dk → 30 dk → 4 sa", () => {
    const { row, at } = climb(6);
    let card = review(row, Rating.Again, at);
    const waits: number[] = [];
    for (let i = 0; i < 4; i++) {
      const t = new Date(card.due);
      card = review(card, Rating.Good, t);
      waits.push(wait(card, t));
    }
    expect(waits).toEqual([20 * SECOND, 3 * MINUTE, 30 * MINUTE, 4 * HOUR]);
  });

  it("günlerce aralıktaki kartın unutulması 'unutma' sayılır; kısa aralıktaki sayılmaz", () => {
    const long = climb(5);
    expect(review(long.row, Rating.Again, long.at).lapses).toBe(1);
    const short = climb(3);
    expect(review(short.row, Rating.Again, short.at).lapses).toBe(0);
  });
});

describe("merdiven: zor ve çok kolay (klavye)", () => {
  it("zor: basamak değişmez, aynı süre bir kez daha beklenir", () => {
    const { row, at } = climb(4);
    const next = review(row, Rating.Hard, at);
    expect(levelOf(next)).toBe(4);
    expect(wait(next, at)).toBe(4 * HOUR);
    expect(wait(review(null, Rating.Hard, T0), T0)).toBe(20 * SECOND);
  });

  it("çok kolay: iki basamak çıkar, tepeyi aşmaz", () => {
    const row = review(null, Rating.Easy, T0);
    expect(levelOf(row)).toBe(2);
    expect(wait(row, T0)).toBe(3 * MINUTE);
    const top = climb(8);
    expect(levelOf(review(top.row, Rating.Easy, top.at))).toBe(MAX_LEVEL);
  });

  it("yeni kartta bilmedim ≤ zor < bildim < çok kolay sırasıyla daha uzak zaman verir", () => {
    const dues = GRADES.map((grade) => Date.parse(review(null, grade, T0).due));
    expect(dues[0]!).toBeLessThanOrEqual(dues[1]!);
    expect(dues[1]!).toBeLessThanOrEqual(dues[2]!);
    expect(dues[2]!).toBeLessThan(dues[3]!);
  });
});

describe("merdiven: erken tekrar (serbest tekrar)", () => {
  it("zamanından günler önce bilinen kart basamak atlamaz, zamanı değişmez", () => {
    const { row, at } = climb(6); // 3 gün bekliyor
    const early = new Date(at.getTime() - 2 * DAY);
    const next = review(row, Rating.Good, early);
    expect(levelOf(next)).toBe(6);
    expect(next.due).toBe(row.due);
    expect(next.state).toBe(row.state);
    expect(next.scheduled_days).toBe(row.scheduled_days);
    expect(next.reps).toBe(row.reps + 1);
  });

  it("erken tekrarda bilinmeyen kart yine en başa döner ve 20 sn sonra gelir", () => {
    const { row, at } = climb(6);
    const early = new Date(at.getTime() - DAY);
    const next = review(row, Rating.Again, early);
    expect(levelOf(next)).toBe(0);
    expect(wait(next, early)).toBe(20 * SECOND);
  });

  it("birkaç dakikalık saat farkı erken sayılmaz", () => {
    const { row, at } = climb(3); // 30 dk bekliyor
    const slightlyEarly = new Date(at.getTime() - 2 * MINUTE);
    expect(levelOf(review(row, Rating.Good, slightlyEarly))).toBe(4);
  });

  it("geç kalınan kart da normal işlenir", () => {
    const { row, at } = climb(5);
    const late = new Date(at.getTime() + 10 * DAY);
    const next = review(row, Rating.Good, late);
    expect(levelOf(next)).toBe(6);
    expect(wait(next, late)).toBe(3 * DAY);
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
    expect(climb(4).row).toMatchObject({ state: State.Learning, scheduled_days: 0 });
    expect(climb(5).row).toMatchObject({ state: State.Review, scheduled_days: 1 });
    expect(climb(8).row).toMatchObject({ state: State.Review, scheduled_days: 21 });
    expect(climb(9).row).toMatchObject({ state: State.Review, scheduled_days: 60 });
  });

  it("tarihler UTC ISO metni; veritabanından gelen +00:00 biçimi de okunur", () => {
    const row = review(null, Rating.Good, T0);
    expect(row.due).toMatch(/Z$/);
    const fromDb = { ...row, due: row.due.replace("Z", "+00:00") };
    const next = review(fromDb, Rating.Good, new Date(row.due));
    expect(wait(next, new Date(row.due))).toBe(3 * MINUTE);
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
