import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../calendar/types";
import {
  applyBusy,
  applyEvents,
  buildSlotGrid,
  deriveEffectiveOptions,
  type GridOptions,
} from "../domain/slots";
import { fromJst } from "../lib/time";

function ev(overrides: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "id",
    summary: "Event",
    start: fromJst(2026, 1, 1, 10, 0).toISOString(),
    end: fromJst(2026, 1, 1, 11, 0).toISOString(),
    allDay: false,
    ...overrides,
  };
}

const baseOpts: GridOptions = {
  startHour: 9,
  endHour: 11,
  daysAhead: 1,
  weekdaysOnly: false,
};

describe("buildSlotGrid", () => {
  it("1日分・9-11時で30分×4枠を生成する", () => {
    const grid = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), baseOpts);
    expect(grid).toHaveLength(1);
    const day = grid[0];
    expect(day.dayISO).toBe("2026-01-01");
    expect(day.slots).toHaveLength(4);
    expect(day.slots[0].start.toISOString()).toBe(fromJst(2026, 1, 1, 9, 0).toISOString());
    expect(day.slots[0].key).toBe("2026-01-01#0");
    expect(day.slots[3].end.toISOString()).toBe(fromJst(2026, 1, 1, 11, 0).toISOString());
    expect(day.slots.every((s) => !s.busy)).toBe(true);
  });

  it("weekdaysOnly で土日を除外する", () => {
    // 2026-01-01(木) から7日分 → 土(1/3)・日(1/4) を除外し5日。
    const grid = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), {
      ...baseOpts,
      daysAhead: 7,
      weekdaysOnly: true,
    });
    const isoDays = grid.map((d) => d.dayISO);
    expect(isoDays).not.toContain("2026-01-03");
    expect(isoDays).not.toContain("2026-01-04");
    expect(grid).toHaveLength(5);
  });
});

describe("applyBusy", () => {
  it("重なる枠だけ busy にし、半開区間の境界は busy にしない", () => {
    const grid = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), baseOpts);
    const busy = [
      { start: fromJst(2026, 1, 1, 9, 30).toISOString(), end: fromJst(2026, 1, 1, 10, 0).toISOString() },
    ];
    const next = applyBusy(grid, busy);
    const slots = next[0].slots;
    expect(slots[0].busy).toBe(false); // 9:00-9:30 (end==busy.start は重ならない)
    expect(slots[1].busy).toBe(true); // 9:30-10:00
    expect(slots[2].busy).toBe(false); // 10:00-10:30 (start==busy.end は重ならない)
  });

  it("元の grid を変更しない (イミュータブル)", () => {
    const grid = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), baseOpts);
    const busy = [
      { start: fromJst(2026, 1, 1, 9, 30).toISOString(), end: fromJst(2026, 1, 1, 10, 0).toISOString() },
    ];
    applyBusy(grid, busy);
    expect(grid[0].slots[1].busy).toBe(false);
  });
});

describe("applyEvents", () => {
  it("時刻指定予定: 重なる枠を busy にし、開始枠だけに labelEvents", () => {
    const grid = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), baseOpts);
    const event = ev({
      id: "mtg",
      summary: "MTG",
      start: fromJst(2026, 1, 1, 10, 0).toISOString(),
      end: fromJst(2026, 1, 1, 10, 30).toISOString(),
    });
    const next = applyEvents(grid, [event]);
    const slots = next[0].slots;
    expect(slots[1].busy).toBe(false);
    expect(slots[2].busy).toBe(true);
    expect(slots[2].events.map((e) => e.summary)).toEqual(["MTG"]);
    expect(slots[2].labelEvents.map((e) => e.summary)).toEqual(["MTG"]);
    expect(slots[3].busy).toBe(false); // 半開で重ならない
  });

  it("終日予定: 全枠が busy、最初の枠だけ labelEvents、後続は events のみ", () => {
    const grid = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), baseOpts);
    const event = ev({
      id: "hol",
      summary: "Holiday",
      start: "2026-01-01T00:00:00+09:00",
      end: "2026-01-02T00:00:00+09:00",
      allDay: true,
    });
    const next = applyEvents(grid, [event]);
    const slots = next[0].slots;
    expect(slots.every((s) => s.busy)).toBe(true);
    expect(slots[0].labelEvents.map((e) => e.summary)).toEqual(["Holiday"]);
    expect(slots[1].labelEvents).toEqual([]);
    expect(slots[1].events.map((e) => e.summary)).toEqual(["Holiday"]);
  });

  it("複数の予定が重なる枠は events 全件、ラベルは各予定の初回登場枠に出る", () => {
    const grid = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), baseOpts);
    const events = [
      ev({
        id: "a",
        summary: "A",
        start: fromJst(2026, 1, 1, 9, 0).toISOString(),
        end: fromJst(2026, 1, 1, 11, 0).toISOString(),
      }),
      ev({
        id: "b",
        summary: "B",
        start: fromJst(2026, 1, 1, 10, 0).toISOString(),
        end: fromJst(2026, 1, 1, 10, 30).toISOString(),
      }),
    ];
    const next = applyEvents(grid, events);
    const slots = next[0].slots;
    // 10:00-10:30 は A と B 両方と重なる
    expect(slots[2].events.map((e) => e.summary).sort()).toEqual(["A", "B"]);
    // ラベルは A は 9:00 (slot 0)、B は 10:00 (slot 2)
    expect(slots[0].labelEvents.map((e) => e.summary)).toEqual(["A"]);
    expect(slots[2].labelEvents.map((e) => e.summary)).toEqual(["B"]);
  });
});

describe("deriveEffectiveOptions", () => {
  const opts: GridOptions = { startHour: 9, endHour: 18, daysAhead: 14, weekdaysOnly: true };

  it("早朝/夜の予定で時間範囲を拡張する", () => {
    const events = [
      ev({ start: fromJst(2026, 1, 1, 7, 0).toISOString(), end: fromJst(2026, 1, 1, 8, 0).toISOString() }),
      ev({ start: fromJst(2026, 1, 1, 20, 0).toISOString(), end: fromJst(2026, 1, 1, 21, 15).toISOString() }),
    ];
    const out = deriveEffectiveOptions(opts, events);
    expect(out.startHour).toBe(7);
    expect(out.endHour).toBe(22); // 21:15 → 切り上げ
  });

  it("土日の予定で weekdaysOnly=false にする", () => {
    // 2026-01-03 は土曜
    const event = ev({
      start: fromJst(2026, 1, 3, 10, 0).toISOString(),
      end: fromJst(2026, 1, 3, 11, 0).toISOString(),
    });
    const out = deriveEffectiveOptions(opts, [event]);
    expect(out.weekdaysOnly).toBe(false);
  });

  it("終日予定は時間拡張せず、週末判定のみ行う", () => {
    const event = ev({
      summary: "Holiday",
      start: "2026-01-03T00:00:00+09:00",
      end: "2026-01-04T00:00:00+09:00",
      allDay: true,
    });
    const out = deriveEffectiveOptions(opts, [event]);
    expect(out.startHour).toBe(opts.startHour); // 時間は変えない
    expect(out.endHour).toBe(opts.endHour);
    expect(out.weekdaysOnly).toBe(false); // 1/3 は土
  });

  it("予定が無ければ既定を維持", () => {
    expect(deriveEffectiveOptions(opts, [])).toEqual(opts);
  });
});
