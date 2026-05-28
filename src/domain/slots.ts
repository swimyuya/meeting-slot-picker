/**
 * 30分枠グリッドのモデルと、Google カレンダーの予定を重ねる処理。
 * すべてイミュータブル: 既存オブジェクトは変更せず、常に新しい配列・オブジェクトを返す。
 */

import type { CalendarEvent } from "../calendar/types";
import {
  DAY_MS,
  MINUTE_MS,
  SLOT_MINUTES,
  fromJst,
  parseDayISO,
  startOfJstDay,
  toDayISO,
  toJstParts,
} from "../lib/time";

/** グリッド生成のオプション (config.ts の AppConfig と互換)。 */
export interface GridOptions {
  startHour: number;
  endHour: number;
  daysAhead: number;
  weekdaysOnly: boolean;
}

/** 30分の枠。start/end は絶対時刻 (instant)。 */
export interface Slot {
  readonly key: string;
  readonly dayISO: string;
  readonly index: number;
  readonly start: Date;
  readonly end: Date;
  readonly busy: boolean;
  /** この枠と重なる全ての予定 (ツールチップ用)。busy=true なら必ず1件以上。 */
  readonly events: readonly CalendarEvent[];
  /** この枠でタイトル表示すべき予定 (各予定の最初の重なり枠で1回だけ)。 */
  readonly labelEvents: readonly CalendarEvent[];
}

export interface DayColumn {
  readonly dayISO: string;
  readonly weekday: number;
  readonly slots: readonly Slot[];
}

/** freeBusy 互換の busy 区間 (legacy 用)。 */
export interface BusyInterval {
  readonly start: string;
  readonly end: string;
}

/** now (JST) を起点に、列=日・行=時刻のグリッドを生成する。 */
export function buildSlotGrid(now: Date, opts: GridOptions): DayColumn[] {
  const todayStart = startOfJstDay(now).getTime();
  const columns: DayColumn[] = [];
  for (let offset = 0; offset < opts.daysAhead; offset++) {
    const dayStart = new Date(todayStart + offset * DAY_MS);
    const { weekday } = toJstParts(dayStart);
    if (opts.weekdaysOnly && (weekday === 0 || weekday === 6)) continue;
    const dayISO = toDayISO(dayStart);
    columns.push({ dayISO, weekday, slots: buildDaySlots(dayISO, opts) });
  }
  return columns;
}

/** 旧 freeBusy 互換: 重なる枠だけ busy=true にする (event/eventStartHere は付与しない)。 */
export function applyBusy(
  columns: readonly DayColumn[],
  busy: readonly BusyInterval[],
): DayColumn[] {
  const intervals = busy.map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));
  return columns.map((col) => ({
    ...col,
    slots: col.slots.map((slot) => {
      const s = slot.start.getTime();
      const e = slot.end.getTime();
      const isBusy = intervals.some((iv) => s < iv.end && e > iv.start);
      return isBusy === slot.busy ? slot : { ...slot, busy: isBusy };
    }),
  }));
}

/**
 * events.list で取得した予定をグリッドに重ねる。
 * - slot.events: その枠と重なる全予定 (ツールチップで列挙する用)
 * - slot.labelEvents: その枠でタイトルを描画する予定 (各予定について、その列で初めて重なる
 *   枠だけにラベルを付ける。これで同じ予定のタイトルが連続セルに繰り返されない)
 */
export function applyEvents(
  columns: readonly DayColumn[],
  events: readonly CalendarEvent[],
): DayColumn[] {
  const intervals = events.map((ev) => ({
    start: new Date(ev.start).getTime(),
    end: new Date(ev.end).getTime(),
    event: ev,
  }));
  return columns.map((col) => {
    // この列で各予定が最初に重なる枠 (= ラベル表示位置) を先に決める。
    const labelSlotByEventId: Record<string, number> = {};
    for (const iv of intervals) {
      for (let i = 0; i < col.slots.length; i++) {
        const slot = col.slots[i];
        if (slot.start.getTime() < iv.end && slot.end.getTime() > iv.start) {
          labelSlotByEventId[iv.event.id] = i;
          break;
        }
      }
    }
    return {
      ...col,
      slots: col.slots.map((slot) => {
        const s = slot.start.getTime();
        const e = slot.end.getTime();
        const overlapping = intervals
          .filter((iv) => s < iv.end && e > iv.start)
          .map((iv) => iv.event);
        const labelEvents = overlapping.filter(
          (ev) => labelSlotByEventId[ev.id] === slot.index,
        );
        const busy = overlapping.length > 0;
        return { ...slot, busy, events: overlapping, labelEvents };
      }),
    };
  });
}

/**
 * 予定に合わせて表示範囲を自動拡張する (時間外・週末の予定が見えなくなるのを防ぐ)。
 * - 週末の予定があれば weekdaysOnly=false
 * - 時刻指定予定の start/end に合わせて startHour/endHour を広げる
 * - 終日予定は時間拡張せず、週末判定のみ (1日中で 0-24 にしてしまうのを防ぐ)
 */
export function deriveEffectiveOptions(
  opts: GridOptions,
  events: readonly CalendarEvent[],
): GridOptions {
  let { startHour, endHour, weekdaysOnly } = opts;
  for (const ev of events) {
    const sParts = toJstParts(new Date(ev.start));
    const eParts = toJstParts(new Date(ev.end));
    if (sParts.weekday === 0 || sParts.weekday === 6) weekdaysOnly = false;
    if (eParts.weekday === 0 || eParts.weekday === 6) weekdaysOnly = false;
    if (ev.allDay) continue;
    if (sParts.hour < startHour) startHour = sParts.hour;
    const ceilHour = eParts.hour + (eParts.minute > 0 ? 1 : 0);
    if (ceilHour > endHour) endHour = Math.min(24, ceilHour);
  }
  if (endHour <= startHour) endHour = Math.min(24, startHour + 1);
  return { ...opts, startHour, endHour, weekdaysOnly };
}

function buildDaySlots(dayISO: string, opts: GridOptions): Slot[] {
  const { year, month, day } = parseDayISO(dayISO);
  const count = (opts.endHour - opts.startHour) * 2;
  const slots: Slot[] = [];
  for (let index = 0; index < count; index++) {
    const minutesFromStart = index * SLOT_MINUTES;
    const hour = opts.startHour + Math.floor(minutesFromStart / 60);
    const minute = minutesFromStart % 60;
    const start = fromJst(year, month, day, hour, minute);
    const end = new Date(start.getTime() + SLOT_MINUTES * MINUTE_MS);
    slots.push({
      key: `${dayISO}#${index}`,
      dayISO,
      index,
      start,
      end,
      busy: false,
      events: [],
      labelEvents: [],
    });
  }
  return slots;
}
