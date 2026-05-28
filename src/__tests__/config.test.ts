import { beforeEach, describe, expect, it } from "vitest";
import {
  AppConfigSchema,
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
} from "../lib/config";

beforeEach(() => localStorage.clear());

describe("AppConfig schema", () => {
  it("既定値を補完する", () => {
    expect(DEFAULT_CONFIG).toMatchObject({
      startHour: 9,
      endHour: 18,
      weekdaysOnly: true,
      daysAhead: 14,
      calendarId: "primary",
      timeZone: "Asia/Tokyo",
      shortcut: "CmdOrControl+Shift+U",
    });
  });

  it("部分指定は既定値とマージする", () => {
    const c = AppConfigSchema.parse({ startHour: 10 });
    expect(c.startHour).toBe(10);
    expect(c.endHour).toBe(18);
  });

  it("endHour <= startHour は拒否する", () => {
    expect(() => AppConfigSchema.parse({ startHour: 18, endHour: 18 })).toThrow();
  });

  it("範囲外の値は拒否する", () => {
    expect(() => AppConfigSchema.parse({ startHour: 99 })).toThrow();
  });
});

describe("loadConfig / saveConfig (localStorage)", () => {
  it("未保存なら既定値を返す", async () => {
    expect(await loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it("保存した値をラウンドトリップする", async () => {
    await saveConfig({ ...DEFAULT_CONFIG, startHour: 8, daysAhead: 7 });
    const loaded = await loadConfig();
    expect(loaded.startHour).toBe(8);
    expect(loaded.daysAhead).toBe(7);
  });

  it("壊れた保存値は既定にフォールバックする", async () => {
    localStorage.setItem("meeting-slot-picker:config", "{not json");
    expect(await loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it("スキーマ違反の保存値も既定にフォールバックする", async () => {
    localStorage.setItem("meeting-slot-picker:config", JSON.stringify({ startHour: 999 }));
    expect(await loadConfig()).toEqual(DEFAULT_CONFIG);
  });
});
