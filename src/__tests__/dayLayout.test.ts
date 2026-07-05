import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../calendar/types";
import {
  barGeometry,
  eventsForDay,
  layoutTimedEvents,
  SLOT_DURATION_MS,
  type TimedEventLayout,
} from "../domain/dayLayout";
import { fromJst, MINUTE_MS, SLOT_MINUTES } from "../lib/time";

function ev(over: Partial<CalendarEvent>): CalendarEvent {
  return {
    id: "x",
    summary: "X",
    start: fromJst(2026, 1, 1, 10, 0).toISOString(),
    end: fromJst(2026, 1, 1, 11, 0).toISOString(),
    allDay: false,
    ...over,
  };
}

describe("eventsForDay", () => {
  it("該当日と重なる予定だけを allDay / timed に分類する", () => {
    const events = [
      ev({ id: "t1", summary: "T1" }),
      ev({ id: "a1", summary: "A1", allDay: true, start: "2026-01-01T00:00:00+09:00", end: "2026-01-02T00:00:00+09:00" }),
      ev({ id: "outside", summary: "Out", start: fromJst(2026, 1, 5, 10, 0).toISOString(), end: fromJst(2026, 1, 5, 11, 0).toISOString() }),
    ];
    const out = eventsForDay(events, "2026-01-01");
    expect(out.timed.map((e) => e.id)).toEqual(["t1"]);
    expect(out.allDay.map((e) => e.id)).toEqual(["a1"]);
  });
});

describe("layoutTimedEvents", () => {
  const dayStart = fromJst(2026, 1, 1, 0, 0).getTime();
  const dayEnd = fromJst(2026, 1, 2, 0, 0).getTime();

  it("重ならない予定は同じレーン (0) を共有する", () => {
    const a = ev({ id: "a", start: fromJst(2026, 1, 1, 9, 0).toISOString(), end: fromJst(2026, 1, 1, 10, 0).toISOString() });
    const b = ev({ id: "b", start: fromJst(2026, 1, 1, 11, 0).toISOString(), end: fromJst(2026, 1, 1, 12, 0).toISOString() });
    const out = layoutTimedEvents([a, b], dayStart, dayEnd);
    expect(out.find((l) => l.event.id === "a")!.lane).toBe(0);
    expect(out.find((l) => l.event.id === "b")!.lane).toBe(0);
    expect(out.every((l) => l.laneCount === 1)).toBe(true);
  });

  it("重なる予定は別レーンに割り当てられ、laneCount が増える", () => {
    const a = ev({ id: "a", start: fromJst(2026, 1, 1, 10, 0).toISOString(), end: fromJst(2026, 1, 1, 11, 0).toISOString() });
    const b = ev({ id: "b", start: fromJst(2026, 1, 1, 10, 30).toISOString(), end: fromJst(2026, 1, 1, 11, 30).toISOString() });
    const out = layoutTimedEvents([a, b], dayStart, dayEnd);
    const la = out.find((l) => l.event.id === "a")!;
    const lb = out.find((l) => l.event.id === "b")!;
    expect(la.lane).not.toBe(lb.lane);
    expect(la.laneCount).toBe(2);
    expect(lb.laneCount).toBe(2);
  });

  it("表示範囲と交差しない予定は除外される", () => {
    const inside = ev({ id: "in", start: fromJst(2026, 1, 1, 10, 0).toISOString(), end: fromJst(2026, 1, 1, 11, 0).toISOString() });
    const outside = ev({ id: "out", start: fromJst(2026, 1, 5, 10, 0).toISOString(), end: fromJst(2026, 1, 5, 11, 0).toISOString() });
    const out = layoutTimedEvents([inside, outside], dayStart, dayEnd);
    expect(out.map((l) => l.event.id)).toEqual(["in"]);
  });
});

describe("SLOT_DURATION_MS", () => {
  it("lib/time の SLOT_MINUTES から導出される (30分)", () => {
    expect(SLOT_DURATION_MS).toBe(SLOT_MINUTES * MINUTE_MS);
    expect(SLOT_DURATION_MS).toBe(30 * 60 * 1000);
  });
});

describe("barGeometry", () => {
  const gridStart = fromJst(2026, 1, 1, 9, 0).getTime();
  const timeAreaHeight = 2 * 28; // 9:00-10:00 の 2 スロット

  function layoutOf(startMin: number, endMin: number, lane = 0, laneCount = 1): TimedEventLayout {
    return {
      event: ev({}),
      startMs: gridStart + startMin * 60_000,
      endMs: gridStart + endMin * 60_000,
      lane,
      laneCount,
    };
  }

  it("範囲内: 30分イベントは top 0 / height 28 / 全幅", () => {
    expect(barGeometry(layoutOf(0, 30), gridStart, timeAreaHeight)).toEqual({
      topPx: 0,
      heightPx: 28,
      leftPct: 0,
      widthPct: 100,
    });
  });

  it("グリッド開始より前に始まる予定は top 0 にクランプされる", () => {
    const g = barGeometry(layoutOf(-30, 30), gridStart, timeAreaHeight);
    expect(g.topPx).toBe(0);
    expect(g.heightPx).toBe(28);
  });

  it("グリッド終了を越える予定は下端にクランプされる", () => {
    const g = barGeometry(layoutOf(30, 120), gridStart, timeAreaHeight);
    expect(g.topPx).toBe(28);
    expect(g.heightPx).toBe(28); // 56 (下端) - 28
  });

  it("5分イベントは最小高 14px に切り上げる", () => {
    const g = barGeometry(layoutOf(0, 5), gridStart, timeAreaHeight);
    expect(g.heightPx).toBe(14);
  });

  it("2レーン目 (lane=1, laneCount=2) は left 50% / width 50%", () => {
    const g = barGeometry(layoutOf(0, 30, 1, 2), gridStart, timeAreaHeight);
    expect(g.leftPct).toBe(50);
    expect(g.widthPct).toBe(50);
  });
});
