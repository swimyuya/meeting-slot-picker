import type { CalendarEvent } from "../calendar/types";
import { eventsForDay, layoutTimedEvents, SLOT_HEIGHT_PX } from "../domain/dayLayout";
import type { Selection } from "../domain/selection";
import type { DayColumn } from "../domain/slots";
import { formatDayLabel, toDayISO, toHHMM } from "../lib/time";
import { EventBars } from "./EventBars";
import { NowIndicator } from "./NowIndicator";
import { SlotCell } from "./SlotCell";

interface Props {
  columns: readonly DayColumn[];
  events: readonly CalendarEvent[];
  selection: Selection;
  /** 現在時刻。渡すと今日の列に現在時刻ラインを描く。 */
  now?: Date;
  onCellDown: (key: string, isSelected: boolean) => void;
  onCellEnter: (key: string) => void;
}

/**
 * カレンダー風週グリッド。
 * - 上段: 日付ヘッダ (今日はブランド色ハイライト) + 終日予定ストリップ
 * - 下段: 30分枠グリッド (選択ターゲット) + 時刻予定バー + 現在時刻ライン
 */
export function WeekGrid({ columns, events, selection, now, onCellDown, onCellEnter }: Props) {
  if (columns.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 dark:text-zinc-500">
        表示できる日がありません。設定を確認してください。
      </div>
    );
  }
  const rowCount = Math.min(...columns.map((c) => c.slots.length));
  const todayISO = now ? toDayISO(now) : null;

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
        <div className="flex w-11 flex-none flex-col bg-white dark:bg-zinc-950">
          <div className="h-7 border-b border-gray-100 dark:border-zinc-800/80" />
          <div
            className="border-b border-gray-100 pr-1.5 text-right text-[9px] leading-[18px] text-gray-400 dark:border-zinc-800/80 dark:text-zinc-500"
            style={{ height: allDayHeight }}
          >
            終日
          </div>
          {Array.from({ length: rowCount }).map((_, i) => (
            <div
              key={i}
              className="h-7 border-b border-gray-100 pr-1.5 text-right text-[10px] leading-7 tabular-nums text-gray-400 dark:border-zinc-800/80 dark:text-zinc-500"
            >
              {toHHMM(columns[0].slots[i].start)}
            </div>
          ))}
        </div>
        {/* 日付列 */}
        {dayItems.map(({ col, allDay, layouts, gridStartMs }) => {
          const isToday = col.dayISO === todayISO;
          return (
            <div
              key={col.dayISO}
              className={`flex min-w-[60px] flex-1 flex-col border-l border-gray-100 dark:border-zinc-800/80 ${
                isToday ? "bg-brand-50/40 dark:bg-brand-500/[0.06]" : ""
              }`}
            >
              {/* 日付ヘッダ */}
              <div className="flex h-7 items-center justify-center border-b border-gray-100 bg-white/60 text-xs dark:border-zinc-800/80 dark:bg-zinc-950/60">
                <span
                  className={
                    isToday
                      ? "rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-bold leading-none text-white shadow-sm"
                      : `font-medium ${dayLabelTone(col.weekday)}`
                  }
                >
                  {formatDayLabel(col.dayISO, col.weekday)}
                </span>
              </div>
              {/* 終日ストリップ (各予定が独立バー、複数あれば縦に積む) */}
              <div
                className="overflow-hidden border-b border-gray-100 bg-white/40 p-0.5 dark:border-zinc-800/80 dark:bg-zinc-950/40"
                style={{ height: allDayHeight }}
              >
                <div className="flex flex-col gap-0.5">
                  {allDay.map((ev) => (
                    <div
                      key={ev.id}
                      title={`終日 ${ev.summary}`}
                      className="truncate rounded bg-gray-200/80 px-1 text-[10px] leading-4 text-gray-700 dark:bg-zinc-700/70 dark:text-zinc-200"
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
                <EventBars
                  layouts={layouts}
                  gridStartMs={gridStartMs}
                  timeAreaHeight={timeAreaHeight}
                  variant="week"
                />
                {isToday && now && (
                  <NowIndicator now={now} gridStartMs={gridStartMs} timeAreaHeight={timeAreaHeight} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 曜日別の日付ラベル色 (日=赤 / 土=青 / 平日=グレー)。 */
function dayLabelTone(weekday: number): string {
  if (weekday === 0) return "text-red-500/80 dark:text-red-400/80";
  if (weekday === 6) return "text-blue-500/80 dark:text-blue-400/80";
  return "text-gray-600 dark:text-zinc-300";
}
