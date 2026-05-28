/**
 * MobileDayView の基本動作: 初期日表示・チップで日切替・終日ストリップ表示・空時のメッセージ。
 * スワイプ自体は jsdom で完全再現が困難なため、ボタン操作で日切替を検証する。
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "../calendar/types";
import { MobileDayView } from "../components/MobileDayView";
import { applyEvents, buildSlotGrid } from "../domain/slots";
import { EMPTY_SELECTION } from "../domain/selection";

const now = new Date("2026-05-28T00:00:00+09:00");
const baseColumns = buildSlotGrid(now, {
  startHour: 9,
  endHour: 18,
  daysAhead: 3,
  weekdaysOnly: false,
});

const noop = () => {};

describe("MobileDayView", () => {
  it("初期表示で 1 日目のヘッダを描画する", () => {
    render(
      <MobileDayView
        columns={baseColumns}
        events={[]}
        selection={EMPTY_SELECTION}
        onCellDown={noop}
        onCellEnter={noop}
      />,
    );
    // 1日目のロングラベル (5/28 など) が見える
    expect(screen.getByText(/5\/28/)).toBeInTheDocument();
    // チップに「今日」「明日」がある
    expect(screen.getByRole("button", { name: "今日" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "明日" })).toBeInTheDocument();
  });

  it("チップをクリックすると別日に切り替わる", () => {
    render(
      <MobileDayView
        columns={baseColumns}
        events={[]}
        selection={EMPTY_SELECTION}
        onCellDown={noop}
        onCellEnter={noop}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "明日" }));
    // ロングラベル (5/29) が現れる
    expect(screen.getByText(/5\/29/)).toBeInTheDocument();
  });

  it("終日予定があれば終日ストリップに表示する", () => {
    const event: CalendarEvent = {
      id: "h1",
      summary: "祝日テスト",
      start: "2026-05-28T00:00:00+09:00",
      end: "2026-05-29T00:00:00+09:00",
      allDay: true,
    };
    const columnsWithEvent = applyEvents(baseColumns, [event]);
    render(
      <MobileDayView
        columns={columnsWithEvent}
        events={[event]}
        selection={EMPTY_SELECTION}
        onCellDown={noop}
        onCellEnter={noop}
      />,
    );
    expect(screen.getByText("祝日テスト")).toBeInTheDocument();
  });

  it("columns が空ならメッセージを表示する", () => {
    render(
      <MobileDayView
        columns={[]}
        events={[]}
        selection={EMPTY_SELECTION}
        onCellDown={noop}
        onCellEnter={noop}
      />,
    );
    expect(screen.getByText(/表示できる日がありません/)).toBeInTheDocument();
  });
});
