import { useEffect, useMemo, useState } from "react";
import type { CalendarEvent } from "../calendar/types";
import { eventsForDay, layoutTimedEvents, SLOT_HEIGHT_PX } from "../domain/dayLayout";
import type { Selection } from "../domain/selection";
import type { DayColumn } from "../domain/slots";
import { useHorizontalSwipe } from "../hooks/useHorizontalSwipe";
import { formatDayLabel, toDayISO, toHHMM } from "../lib/time";
import { EventBars } from "./EventBars";
import { IconChevronLeft, IconChevronRight } from "./icons";
import { NowIndicator } from "./NowIndicator";
import { SlotCell } from "./SlotCell";

interface Props {
  columns: readonly DayColumn[];
  events: readonly CalendarEvent[];
  selection: Selection;
  /** 現在時刻。今日を表示中なら現在時刻ラインを描く。 */
  now?: Date;
  onCellDown: (key: string, isSelected: boolean) => void;
  onCellEnter: (key: string) => void;
}

/**
 * モバイル向け 1日スワイプビュー。
 * - 上部: 日付ヘッダ + 前後ボタン + 日付チップ一覧
 * - 中央: 終日ストリップ + 縦スクロール時間軸 (30分セル + 絶対配置イベントバー)
 * - 横スワイプで日付遷移、縦スワイプは普通の縦スクロール
 *
 * 既存のドメインロジック (dayLayout / SlotCell) を共有しているため、PC版と挙動は同等。
 */
export function MobileDayView({
  columns,
  events,
  selection,
  now,
  onCellDown,
  onCellEnter,
}: Props) {
  const [idx, setIdx] = useState(0);

  // columns が変わった (再フェッチ等) ら範囲外を補正。
  useEffect(() => {
    if (idx >= columns.length && columns.length > 0) setIdx(0);
  }, [columns.length, idx]);

  const swipeRef = useHorizontalSwipe<HTMLDivElement>({
    onSwipeLeft: () => setIdx((i) => Math.min(columns.length - 1, i + 1)),
    onSwipeRight: () => setIdx((i) => Math.max(0, i - 1)),
  });

  if (columns.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 dark:text-zinc-500">
        表示できる日がありません。設定を確認してください。
      </div>
    );
  }

  const safeIdx = Math.min(idx, columns.length - 1);
  const col = columns[safeIdx];
  const rowCount = col.slots.length;
  const { allDay, timed } = eventsForDay(events, col.dayISO);
  const gridStartMs = col.slots[0].start.getTime();
  const gridEndMs = col.slots[rowCount - 1].end.getTime();
  const layouts = useMemo(
    () => layoutTimedEvents(timed, gridStartMs, gridEndMs),
    [timed, gridStartMs, gridEndMs],
  );

  const timeAreaHeight = rowCount * SLOT_HEIGHT_PX;
  const isTodayView = now ? col.dayISO === toDayISO(now) : false;

  return (
    <div ref={swipeRef} className="flex flex-1 flex-col overflow-hidden">
      {/* 日付ヘッダ + 前後 */}
      <div className="flex flex-none items-center justify-between border-b border-gray-100 bg-white/90 px-2 py-2 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <button
          type="button"
          aria-label="前の日"
          disabled={safeIdx <= 0}
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          className="btn btn-ghost h-8 w-8 rounded-full p-0"
        >
          <IconChevronLeft size={16} />
        </button>
        <span className="text-[15px] font-semibold tracking-tight text-gray-800 dark:text-zinc-100">
          {formatDayLabel(col.dayISO, col.weekday)}
        </span>
        <button
          type="button"
          aria-label="次の日"
          disabled={safeIdx >= columns.length - 1}
          onClick={() => setIdx((i) => Math.min(columns.length - 1, i + 1))}
          className="btn btn-ghost h-8 w-8 rounded-full p-0"
        >
          <IconChevronRight size={16} />
        </button>
      </div>

      {/* 日付チップ */}
      <div className="flex flex-none gap-1.5 overflow-x-auto border-b border-gray-100 bg-gray-50/80 px-2 py-2 dark:border-zinc-800 dark:bg-zinc-900/80">
        {columns.map((c, i) => {
          const label = shortDayLabel(c, i);
          const active = i === safeIdx;
          return (
            <button
              key={c.dayISO}
              type="button"
              onClick={() => setIdx(i)}
              className={`flex-none rounded-full px-3 py-1 text-xs font-medium transition-all duration-150 ${
                active
                  ? "bg-brand text-white shadow-sm"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700 dark:hover:bg-zinc-700"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 終日ストリップ */}
      {allDay.length > 0 && (
        <div className="flex flex-none gap-1 overflow-x-auto border-b border-gray-100 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
          <span className="flex-none self-center text-[10px] font-medium text-gray-400 dark:text-zinc-500">
            終日
          </span>
          {allDay.map((ev) => (
            <span
              key={ev.id}
              title={ev.summary}
              className="flex-none rounded-md bg-gray-200/80 px-2 py-1 text-xs text-gray-700 dark:bg-zinc-700/70 dark:text-zinc-200"
            >
              {ev.summary}
            </span>
          ))}
        </div>
      )}

      {/* 時間軸 */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          <div className="flex w-12 flex-none flex-col bg-white dark:bg-zinc-950">
            {Array.from({ length: rowCount }).map((_, i) => (
              <div
                key={i}
                className="h-7 border-b border-gray-100 pr-1.5 text-right text-[10px] leading-7 tabular-nums text-gray-400 dark:border-zinc-800/80 dark:text-zinc-500"
              >
                {toHHMM(col.slots[i].start)}
              </div>
            ))}
          </div>
          <div
            className="relative flex-1 border-l border-gray-100 dark:border-zinc-800/80"
            style={{ height: timeAreaHeight }}
          >
            {col.slots.map((slot) => (
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
              variant="day"
            />
            {isTodayView && now && (
              <NowIndicator now={now} gridStartMs={gridStartMs} timeAreaHeight={timeAreaHeight} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 日付チップの短いラベル: 今日/明日/日付。 */
function shortDayLabel(col: DayColumn, idx: number): string {
  if (idx === 0) return "今日";
  if (idx === 1) return "明日";
  return formatDayLabel(col.dayISO, col.weekday);
}
