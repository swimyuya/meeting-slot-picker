import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../calendar/types";
import { WeekGrid } from "../components/WeekGrid";
import { applyBusy, applyEvents, buildSlotGrid, type GridOptions } from "../domain/slots";
import { fromJst } from "../lib/time";

const opts: GridOptions = { startHour: 9, endHour: 10, daysAhead: 1, weekdaysOnly: false };

/** 9:00-9:30 を busy、9:30-10:00 を空きにしたグリッド (applyBusy 経由)。 */
function busyGrid() {
  const cols = buildSlotGrid(fromJst(2026, 1, 1, 12, 0), opts);
  const busy = [
    { start: fromJst(2026, 1, 1, 9, 0).toISOString(), end: fromJst(2026, 1, 1, 9, 30).toISOString() },
  ];
  return applyBusy(cols, busy);
}

describe("WeekGrid", () => {
  it("各 30 分枠は role=button で選択可能、busy セルは『予定あり』ラベル", () => {
    render(
      <WeekGrid
        columns={busyGrid()}
        events={[]}
        selection={new Set()}
        onCellDown={vi.fn()}
        onCellEnter={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("予定あり")).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("日付ヘッダを表示する", () => {
    render(
      <WeekGrid
        columns={busyGrid()}
        events={[]}
        selection={new Set()}
        onCellDown={vi.fn()}
        onCellEnter={vi.fn()}
      />,
    );
    expect(screen.getByText("1/1（木）")).toBeInTheDocument();
  });

  it("空き枠の pointerDown で onCellDown を呼ぶ", () => {
    const onCellDown = vi.fn();
    render(
      <WeekGrid
        columns={busyGrid()}
        events={[]}
        selection={new Set()}
        onCellDown={onCellDown}
        onCellEnter={vi.fn()}
      />,
    );
    fireEvent.pointerDown(screen.getByLabelText("空き"));
    expect(onCellDown).toHaveBeenCalled();
  });

  it("busy 枠も pointerDown で選択可能", () => {
    const onCellDown = vi.fn();
    render(
      <WeekGrid
        columns={busyGrid()}
        events={[]}
        selection={new Set()}
        onCellDown={onCellDown}
        onCellEnter={vi.fn()}
      />,
    );
    fireEvent.pointerDown(screen.getByLabelText("予定あり"));
    expect(onCellDown).toHaveBeenCalled();
  });

  it("選択中の枠は aria-pressed=true で表示する", () => {
    const cols = busyGrid();
    const freeKey = cols[0].slots[1].key;
    render(
      <WeekGrid
        columns={cols}
        events={[]}
        selection={new Set([freeKey])}
        onCellDown={vi.fn()}
        onCellEnter={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
  });

  it("終日予定は終日ストリップに各予定が独立して表示される", () => {
    const events: CalendarEvent[] = [
      {
        id: "a",
        summary: "Holiday A",
        start: "2026-01-01T00:00:00+09:00",
        end: "2026-01-02T00:00:00+09:00",
        allDay: true,
      },
      {
        id: "b",
        summary: "Holiday B",
        start: "2026-01-01T00:00:00+09:00",
        end: "2026-01-02T00:00:00+09:00",
        allDay: true,
      },
    ];
    const cols = applyEvents(buildSlotGrid(fromJst(2026, 1, 1, 12, 0), opts), events);
    render(
      <WeekGrid
        columns={cols}
        events={events}
        selection={new Set()}
        onCellDown={vi.fn()}
        onCellEnter={vi.fn()}
      />,
    );
    expect(screen.getByText("Holiday A")).toBeInTheDocument();
    expect(screen.getByText("Holiday B")).toBeInTheDocument();
  });

  it("時刻予定は data-event-id を持つバーとして表示される", () => {
    const event: CalendarEvent = {
      id: "mtg",
      summary: "MTG",
      start: fromJst(2026, 1, 1, 9, 0).toISOString(),
      end: fromJst(2026, 1, 1, 9, 30).toISOString(),
      allDay: false,
    };
    const cols = applyEvents(buildSlotGrid(fromJst(2026, 1, 1, 12, 0), opts), [event]);
    const { container } = render(
      <WeekGrid
        columns={cols}
        events={[event]}
        selection={new Set()}
        onCellDown={vi.fn()}
        onCellEnter={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-event-id="mtg"]')).toBeInTheDocument();
    expect(screen.getByText("MTG")).toBeInTheDocument();
  });
});
