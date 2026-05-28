/**
 * 日付列ごとのイベント配置ロジック。
 * - eventsForDay: その日に該当する予定を allDay / timed に分ける
 * - layoutTimedEvents: 重なる時刻予定をレーンに割り当て、絶対配置できる情報を返す
 */

import type { CalendarEvent } from "../calendar/types";
import { DAY_MS, dayISOToStart } from "../lib/time";

export const SLOT_HEIGHT_PX = 28; // h-7 (= 1.75rem)
export const SLOT_DURATION_MS = 30 * 60 * 1000;

export interface TimedEventLayout {
  readonly event: CalendarEvent;
  readonly startMs: number;
  readonly endMs: number;
  /** 並列レーン (0-indexed)。重なる予定は別レーンに割り当て横並びにする。 */
  readonly lane: number;
  /** 自分の重なりグループの合計レーン数 (横幅の分母)。 */
  readonly laneCount: number;
}

/** その日に該当する予定を allDay / timed に分ける。 */
export function eventsForDay(
  events: readonly CalendarEvent[],
  dayISO: string,
): { allDay: CalendarEvent[]; timed: CalendarEvent[] } {
  const dayStart = dayISOToStart(dayISO).getTime();
  const dayEnd = dayStart + DAY_MS;
  const allDay: CalendarEvent[] = [];
  const timed: CalendarEvent[] = [];
  for (const ev of events) {
    const evStart = new Date(ev.start).getTime();
    const evEnd = new Date(ev.end).getTime();
    if (evStart >= dayEnd || evEnd <= dayStart) continue;
    (ev.allDay ? allDay : timed).push(ev);
  }
  return { allDay, timed };
}

/** 時刻予定をレーンに割り当てる (重なる予定は隣のレーン)。表示範囲と交差しないものは除外。 */
export function layoutTimedEvents(
  timed: readonly CalendarEvent[],
  gridStartMs: number,
  gridEndMs: number,
): TimedEventLayout[] {
  const sorted = timed
    .map((ev) => ({
      ev,
      startMs: new Date(ev.start).getTime(),
      endMs: new Date(ev.end).getTime(),
    }))
    .filter((p) => p.startMs < gridEndMs && p.endMs > gridStartMs)
    .sort((a, b) => a.startMs - b.startMs);

  // 貪欲レーン割当: 既存レーンの終了時刻 <= 自分の開始 なら同レーン再利用、無ければ新レーン
  const laneEnds: number[] = [];
  const items: { event: CalendarEvent; startMs: number; endMs: number; lane: number }[] = [];
  for (const p of sorted) {
    let lane = laneEnds.findIndex((end) => end <= p.startMs);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(p.endMs);
    } else {
      laneEnds[lane] = p.endMs;
    }
    items.push({ event: p.ev, startMs: p.startMs, endMs: p.endMs, lane });
  }

  // 各 item の laneCount = 自分と重なる全 item のうちの最大レーン + 1
  return items.map((item) => {
    const overlap = items.filter((o) => o.startMs < item.endMs && o.endMs > item.startMs);
    const laneCount = Math.max(...overlap.map((o) => o.lane)) + 1;
    return { ...item, laneCount };
  });
}
