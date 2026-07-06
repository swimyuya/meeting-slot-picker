/**
 * イベントバー描画のピクセル単位 pin。
 * WeekGrid と MobileDayView は同じジオメトリで、余白・フォント・時刻ラベル閾値だけ
 * 意図的に異なる。リファクタ (EventBars 共通化) 後もこの出力が変わらないことを保証する。
 *
 *   - WeekGrid:       left calc(+1px) / width calc(-2px) / text-[10px] / 時刻ラベルは高さ>=24
 *   - MobileDayView:  left calc(+2px) / width calc(-4px) / text-[11px] / 時刻ラベルは高さ>=26
 */

import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "../calendar/types";
import { MobileDayView } from "../components/MobileDayView";
import { WeekGrid } from "../components/WeekGrid";
import { buildSlotGrid, type GridOptions } from "../domain/slots";
import { fromJst } from "../lib/time";

const opts: GridOptions = { startHour: 9, endHour: 10, daysAhead: 1, weekdaysOnly: false };

function cols() {
  return buildSlotGrid(fromJst(2026, 1, 1, 12, 0), opts);
}

function timedEvent(
  id: string,
  summary: string,
  startMin: number,
  endMin: number,
  source?: CalendarEvent["source"],
): CalendarEvent {
  const gridStart = fromJst(2026, 1, 1, 9, 0).getTime();
  return {
    id,
    summary,
    start: new Date(gridStart + startMin * 60_000).toISOString(),
    end: new Date(gridStart + endMin * 60_000).toISOString(),
    allDay: false,
    source,
  };
}

function renderWeek(events: CalendarEvent[]) {
  return render(
    <WeekGrid
      columns={cols()}
      events={events}
      selection={new Set()}
      onCellDown={vi.fn()}
      onCellEnter={vi.fn()}
    />,
  );
}

function renderMobile(events: CalendarEvent[]) {
  return render(
    <MobileDayView
      columns={cols()}
      events={events}
      selection={new Set()}
      onCellDown={vi.fn()}
      onCellEnter={vi.fn()}
    />,
  );
}

function bar(container: HTMLElement, id: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-event-id="${id}"]`);
  if (!el) throw new Error(`bar ${id} not found`);
  return el;
}

describe("WeekGrid のイベントバー", () => {
  it("30分イベント: top 0 / height 28 / 1レーンで calc(+1px/-2px)、時刻ラベルあり", () => {
    const { container } = renderWeek([timedEvent("e1", "会議", 0, 30, "microsoft")]);
    const el = bar(container, "e1");
    expect(el.style.top).toBe("0px");
    expect(el.style.height).toBe("28px");
    expect(el.style.left).toBe("calc(0% + 1px)");
    expect(el.style.width).toBe("calc(100% - 2px)");
    expect(el.className).toContain("text-[10px]");
    expect(el.className).toContain("border-l-sky-400 bg-sky-100/85");
    expect(el.getAttribute("data-event-source")).toBe("microsoft");
    expect(el.getAttribute("title")).toBe("9:00-9:30 Outlook: 会議");
    expect(el.textContent).toBe("会議9:00-9:30");
  });

  it("5分イベント: 高さは 14px にクランプされ時刻ラベルは出ない (Apple はピンク)", () => {
    const { container } = renderWeek([timedEvent("e2", "短い", 30, 35, "apple")]);
    const el = bar(container, "e2");
    expect(el.style.top).toBe("28px");
    expect(el.style.height).toBe("14px");
    expect(el.className).toContain("border-l-pink-400 bg-pink-100/85");
    expect(el.getAttribute("title")).toBe("9:30-9:35 Apple: 短い");
    expect(el.textContent).toBe("短い");
  });

  it("source 未指定は data-event-source=google でグレー、prefix なし", () => {
    const { container } = renderWeek([timedEvent("e3", "無印", 0, 30)]);
    const el = bar(container, "e3");
    expect(el.getAttribute("data-event-source")).toBe("google");
    expect(el.className).toContain("border-l-zinc-400 bg-zinc-200/70");
    expect(el.getAttribute("title")).toBe("9:00-9:30 無印");
  });

  it("重なる2件は 50% 幅の2レーンに分かれる", () => {
    const { container } = renderWeek([
      timedEvent("a", "A", 0, 60),
      timedEvent("b", "B", 0, 30),
    ]);
    const elA = bar(container, "a");
    const elB = bar(container, "b");
    expect(elA.style.width).toBe("calc(50% - 2px)");
    expect(elB.style.width).toBe("calc(50% - 2px)");
    expect(new Set([elA.style.left, elB.style.left])).toEqual(
      new Set(["calc(0% + 1px)", "calc(50% + 1px)"]),
    );
  });

  it("26分イベント (高さ約24.3px) は時刻ラベルを表示する (閾値 24)", () => {
    const { container } = renderWeek([timedEvent("t", "境界", 0, 26)]);
    expect(bar(container, "t").textContent).toBe("境界9:00-9:26");
  });
});

describe("MobileDayView のイベントバー", () => {
  it("30分イベント: 同じジオメトリで calc(+2px/-4px)・text-[11px]", () => {
    const { container } = renderMobile([timedEvent("m1", "会議", 0, 30, "microsoft")]);
    const el = bar(container, "m1");
    expect(el.style.top).toBe("0px");
    expect(el.style.height).toBe("28px");
    expect(el.style.left).toBe("calc(0% + 2px)");
    expect(el.style.width).toBe("calc(100% - 4px)");
    expect(el.className).toContain("text-[11px]");
    expect(el.className).toContain("border-l-sky-400 bg-sky-100/85");
    expect(el.getAttribute("title")).toBe("9:00-9:30 Outlook: 会議");
    expect(el.textContent).toBe("会議9:00-9:30");
  });

  it("重なる2件は 50% 幅で calc(50% + 2px) / calc(50% - 4px)", () => {
    const { container } = renderMobile([
      timedEvent("a", "A", 0, 60),
      timedEvent("b", "B", 0, 30),
    ]);
    const elA = bar(container, "a");
    const elB = bar(container, "b");
    expect(elA.style.width).toBe("calc(50% - 4px)");
    expect(elB.style.width).toBe("calc(50% - 4px)");
    expect(new Set([elA.style.left, elB.style.left])).toEqual(
      new Set(["calc(0% + 2px)", "calc(50% + 2px)"]),
    );
  });

  it("26分イベント (高さ約24.3px) は時刻ラベルを出さない (閾値 26 — WeekGrid と異なる)", () => {
    const { container } = renderMobile([timedEvent("t", "境界", 0, 26)]);
    expect(bar(container, "t").textContent).toBe("境界");
  });

  it("5分イベント: 高さ 14px クランプは PC 版と共通", () => {
    const { container } = renderMobile([timedEvent("m2", "短い", 30, 35, "apple")]);
    const el = bar(container, "m2");
    expect(el.style.height).toBe("14px");
    expect(el.className).toContain("border-l-pink-400 bg-pink-100/85");
  });
});
