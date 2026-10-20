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
    [{ display_name: "  " }, "Display name can't be empty."],
    [{ timezone: "Mars/Olympus" }, "Invalid time zone."],
    [{ daily_new_limit: "-1" }, "Minimum is 0."],
    [{ daily_new_limit: "201" }, "Maximum is 200."],
    [{ daily_new_limit: "2.5" }, "Use a whole number."],
    [{ daily_goal_reviews: "0" }, "Minimum is 1."],
    [{ daily_goal_reviews: "abc" }, "Daily goal must be a number."],
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
