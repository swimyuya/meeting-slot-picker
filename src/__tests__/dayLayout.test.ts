import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../calendar/types";
import { eventsForDay, layoutTimedEvents } from "../domain/dayLayout";
import { fromJst } from "../lib/time";

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
