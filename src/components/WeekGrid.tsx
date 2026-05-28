import type { CalendarEvent } from "../calendar/types";
import {
  eventsForDay,
  layoutTimedEvents,
  SLOT_DURATION_MS,
  SLOT_HEIGHT_PX,
} from "../domain/dayLayout";
import type { Selection } from "../domain/selection";
import type { DayColumn } from "../domain/slots";
import { parseDayISO, toHHMM, WEEKDAYS } from "../lib/time";
import { SlotCell } from "./SlotCell";

interface Props {
  columns: readonly DayColumn[];
  events: readonly CalendarEvent[];
  selection: Selection;
  onCellDown: (key: string, isSelected: boolean) => void;
  onCellEnter: (key: string) => void;
}

/**
 * カレンダー風週グリッド。
 * - 上段: 日付ヘッダ + 終日予定ストリップ (各予定が独立した小バー)
 * - 下段: 30分枠グリッド (選択ターゲット) + 時刻予定バー (絶対配置・pointer-events:none)
 */
export function WeekGrid({ columns, events, selection, onCellDown, onCellEnter }: Props) {
  if (columns.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        表示できる日がありません。設定を確認してください。
      </div>
    );
  }
  const rowCount = Math.min(...columns.map((c) => c.slots.length));

  // 各列の終日予定数を揃えるため、最大値で確保
  const dayItems = columns.map((col) => {
    const { allDay, timed } = eventsForDay(events, col.dayISO);
    const gridStartMs = col.slots[0].start.getTime();
    const gridEndMs = col.slots[rowCount - 1].end.getTime();
    return { col, allDay, timed, layouts: layoutTimedEvents(timed, gridStartMs, gridEndMs), gridStartMs };
  });
  const maxAllDay = Math.max(1, ...dayItems.map((d) => d.allDay.length));
  const allDayHeight = maxAllDay * 18 + 4;
  const timeAreaHeight = rowCount * SLOT_HEIGHT_PX;

  return (
    <div className="flex-1 overflow-auto">
      <div className="flex min-h-full">
        {/* 左ガター (時刻ラベル) */}
        <div className="flex w-11 flex-none flex-col bg-white">
          <div className="h-7 border-b border-gray-100" />
          <div
            className="border-b border-gray-100 pr-1 text-right text-[9px] leading-[18px] text-gray-400"
            style={{ height: allDayHeight }}
          >
            終日
          </div>
          {Array.from({ length: rowCount }).map((_, i) => (
            <div
              key={i}
              className="h-7 border-b border-gray-100 pr-1 text-right text-[10px] leading-7 text-gray-400"
            >
              {toHHMM(columns[0].slots[i].start)}
            </div>
          ))}
        </div>
        {/* 日付列 */}
        {dayItems.map(({ col, allDay, layouts, gridStartMs }) => (
          <div
            key={col.dayISO}
            className="flex min-w-[60px] flex-1 flex-col border-l border-gray-100"
          >
            {/* 日付ヘッダ */}
            <div className="h-7 border-b border-gray-100 bg-white py-1 text-center text-xs font-medium text-gray-700">
              {dayLabel(col)}
            </div>
            {/* 終日ストリップ (各予定が独立バー、複数あれば縦に積む) */}
            <div
              className="overflow-hidden border-b border-gray-100 bg-white p-0.5"
              style={{ height: allDayHeight }}
            >
              <div className="flex flex-col gap-0.5">
                {allDay.map((ev) => (
                  <div
                    key={ev.id}
                    title={`終日 ${ev.summary}`}
                    className="truncate rounded bg-gray-300/70 px-1 text-[10px] leading-4 text-gray-800"
                  >
                    {ev.summary}
                  </div>
                ))}
              </div>
            </div>
            {/* 時間エリア (相対配置: 30分枠を縦積み + 時刻予定バーを絶対配置) */}
            <div className="relative" style={{ height: timeAreaHeight }}>
              {col.slots.slice(0, rowCount).map((slot) => (
                <SlotCell
                  key={slot.key}
                  slot={slot}
                  selected={selection.has(slot.key)}
                  onDown={onCellDown}
                  onEnter={onCellEnter}
                />
              ))}
              {/* 時刻予定バー */}
              {layouts.map((layout) => {
                const rawTop = ((layout.startMs - gridStartMs) / SLOT_DURATION_MS) * SLOT_HEIGHT_PX;
                const rawBottom = ((layout.endMs - gridStartMs) / SLOT_DURATION_MS) * SLOT_HEIGHT_PX;
                const top = Math.max(0, rawTop);
                const bottom = Math.min(timeAreaHeight, rawBottom);
                const height = Math.max(14, bottom - top);
                const widthPct = 100 / layout.laneCount;
                const leftPct = (layout.lane / layout.laneCount) * 100;
                const startStr = toHHMM(new Date(layout.event.start));
                const endStr = toHHMM(new Date(layout.event.end));
                return (
                  <div
                    key={layout.event.id}
                    data-event-id={layout.event.id}
                    title={`${startStr}-${endStr} ${layout.event.summary}`}
                    className="pointer-events-none absolute z-10 overflow-hidden rounded border border-gray-400/40 bg-gray-300/55 px-1 text-[10px] leading-tight text-gray-900"
                    style={{
                      top,
                      height,
                      left: `calc(${leftPct}% + 1px)`,
                      width: `calc(${widthPct}% - 2px)`,
                    }}
                  >
                    <div className="truncate font-medium">{layout.event.summary}</div>
                    {height >= 24 && (
                      <div className="truncate text-[9px] text-gray-700">
                        {startStr}-{endStr}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function dayLabel(col: DayColumn): string {
  const { month, day } = parseDayISO(col.dayISO);
  return `${month}/${day}（${WEEKDAYS[col.weekday]}）`;
}
