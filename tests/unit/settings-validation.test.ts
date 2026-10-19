import { describe, expect, it } from "vitest";
import { parseTheme } from "@/lib/theme";
import { profileSettingsSchema, themeSchema } from "@/lib/validation/settings";

const valid = {
  display_name: " Tuna ",
  timezone: "Europe/Istanbul",
  daily_new_limit: "10",
  daily_goal_reviews: "30",
};

describe("ayarlar doğrulama", () => {
  it("geçerli ayarları sayıya çevirir ve kırpar", () => {
    expect(profileSettingsSchema.parse(valid)).toEqual({
      display_name: "Tuna",
      timezone: "Europe/Istanbul",
      daily_new_limit: 10,
      daily_goal_reviews: 30,
    });
  });

  it.each([
    [{ display_name: "  " }, "Görünen ad boş olamaz."],
    [{ timezone: "Mars/Olympus" }, "Geçersiz saat dilimi."],
    [{ daily_new_limit: "-1" }, "En az 0."],
    [{ daily_new_limit: "201" }, "En fazla 200."],
    [{ daily_new_limit: "2.5" }, "Tam sayı yaz."],
    [{ daily_goal_reviews: "0" }, "En az 1."],
    [{ daily_goal_reviews: "abc" }, "Günlük hedef bir sayı olmalı."],
  ])("%j → %s", (patch, message) => {
    const result = profileSettingsSchema.safeParse({ ...valid, ...patch });
    expect(result.error?.issues[0]?.message).toBe(message);
  });
});

describe("tema", () => {
  it("bilinmeyen değeri sisteme çevirir", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("mor")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
    expect(themeSchema.safeParse("light").success).toBe(true);
  });
});
