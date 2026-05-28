/**
 * 選択された30分枠を、日程調整用の日本語テキストに整形する。
 *
 * 既定の出力 (日付ごとに集約・連続枠は結合・同日内は " / " 区切り):
 *   5/23（水）10:00-11:00 / 13:00-13:30
 *   5/24（木）14:00-16:00
 *
 * 純粋関数。テンプレートで体裁を差し替え可能。
 */

import { WEEKDAYS, parseDayISO, toHHMM, weekdayOfDayISO } from "../lib/time";

/** 整形に必要な最小限の枠情報 (domain/slots.ts の Slot が満たす)。 */
export interface FormattableSlot {
  readonly dayISO: string;
  readonly start: Date;
  readonly end: Date;
}

export interface FormatOptions {
  /** 1日分の行テンプレート。{date}=M/D, {wday}=曜日, {ranges}=時間範囲群。 */
  template?: string;
  /** 同日内の複数範囲の区切り。 */
  rangeSeparator?: string;
}

export const DEFAULT_TEMPLATE = "{date}（{wday}）{ranges}";
export const DEFAULT_RANGE_SEPARATOR = " / ";

interface Range {
  start: Date;
  end: Date;
}

export function format(slots: readonly FormattableSlot[], opts: FormatOptions = {}): string {
  if (slots.length === 0) return "";
  const template = opts.template ?? DEFAULT_TEMPLATE;
  const separator = opts.rangeSeparator ?? DEFAULT_RANGE_SEPARATOR;

  const byDay = groupByDay(slots);
  const days = [...byDay.keys()].sort();

  const lines = days.map((dayISO) => {
    const daySlots = [...byDay.get(dayISO)!].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );
    const rangesText = mergeContiguous(daySlots)
      .map((r) => `${toHHMM(r.start)}-${toHHMM(r.end)}`)
      .join(separator);
    const { month, day } = parseDayISO(dayISO);
    return template
      .replace("{date}", `${month}/${day}`)
      .replace("{wday}", WEEKDAYS[weekdayOfDayISO(dayISO)])
      .replace("{ranges}", rangesText);
  });
  return lines.join("\n");
}

/** dayISO ごとにグルーピングした新 Map を返す。 */
function groupByDay(slots: readonly FormattableSlot[]): Map<string, FormattableSlot[]> {
  const byDay = new Map<string, FormattableSlot[]>();
  for (const slot of slots) {
    byDay.set(slot.dayISO, [...(byDay.get(slot.dayISO) ?? []), slot]);
  }
  return byDay;
}

/** start 昇順前提。隣接 (前枠の end == 次枠の start) する枠を1範囲に結合する。 */
function mergeContiguous(sorted: readonly FormattableSlot[]): Range[] {
  const ranges: Range[] = [];
  let cur: Range = { start: sorted[0].start, end: sorted[0].end };
  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.start.getTime() === cur.end.getTime()) {
      cur = { ...cur, end: s.end };
    } else {
      ranges.push(cur);
      cur = { start: s.start, end: s.end };
    }
  }
  ranges.push(cur);
  return ranges;
}
