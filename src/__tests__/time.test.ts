import { describe, expect, it } from "vitest";
import {
  formatDayLabel,
  fromJst,
  isWeekend,
  toDayISO,
  toHHMM,
  toJstParts,
  weekdayOfDayISO,
  WEEKDAYS,
} from "../lib/time";

describe("time (JST helpers)", () => {
  it("2026-01-01 は木曜 (weekday=4)", () => {
    // 2025-01-01 が水曜のため翌年は木曜。
    expect(weekdayOfDayISO("2026-01-01")).toBe(4);
    expect(WEEKDAYS[weekdayOfDayISO("2026-01-01")]).toBe("木");
  });

  it("fromJst は JST 壁時計を正しい UTC instant に変換する", () => {
    // JST 2026-01-01 00:00 = UTC 2025-12-31 15:00。
    expect(fromJst(2026, 1, 1, 0, 0).toISOString()).toBe("2025-12-31T15:00:00.000Z");
    expect(fromJst(2026, 1, 1, 9, 0).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("toJstParts は instant を JST パーツに分解する", () => {
    const p = toJstParts(new Date("2026-01-01T14:30:00.000Z"));
    // UTC 14:30 → JST 23:30 同日。
    expect(p).toMatchObject({ year: 2026, month: 1, day: 1, hour: 23, minute: 30 });
  });

  it("JST 日境界 (UTC 15:00) をまたぐと日付が繰り上がる", () => {
    expect(toDayISO(new Date("2026-01-01T14:59:00.000Z"))).toBe("2026-01-01");
    expect(toDayISO(new Date("2026-01-01T15:00:00.000Z"))).toBe("2026-01-02");
  });

  it("toHHMM は時の先頭ゼロなし・分2桁で返す", () => {
    expect(toHHMM(fromJst(2026, 1, 1, 9, 0))).toBe("9:00");
    expect(toHHMM(fromJst(2026, 1, 1, 13, 30))).toBe("13:30");
    expect(toHHMM(fromJst(2026, 1, 1, 16, 0))).toBe("16:00");
  });

  it("isWeekend は日(0)と土(6)だけ true", () => {
    expect(isWeekend(0)).toBe(true);
    expect(isWeekend(6)).toBe(true);
    expect(isWeekend(1)).toBe(false);
    expect(isWeekend(5)).toBe(false);
  });

  it("formatDayLabel は M/D（曜）形式 (月・日の先頭ゼロなし)", () => {
    expect(formatDayLabel("2026-01-01", 4)).toBe("1/1（木）");
    expect(formatDayLabel("2026-07-06", 1)).toBe("7/6（月）");
  });
});
