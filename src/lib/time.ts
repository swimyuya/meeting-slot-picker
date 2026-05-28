/**
 * JST 固定 (+09:00) 前提の日時ヘルパー。
 *
 * Asia/Tokyo は DST がないため、オフセット計算 (整数演算) だけで壁時計⇔instant を
 * 相互変換できる。Intl や文字列パースを避け、決定論的でテストしやすい実装にする。
 */

export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
export const SLOT_MINUTES = 30;
export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 曜日ラベル (0=日 .. 6=土)。 */
export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export interface JstParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  weekday: number; // 0=日 .. 6=土
}

/** 絶対時刻 (instant) を JST の壁時計パーツに分解する。 */
export function toJstParts(instant: Date): JstParts {
  const j = new Date(instant.getTime() + JST_OFFSET_MS);
  return {
    year: j.getUTCFullYear(),
    month: j.getUTCMonth() + 1,
    day: j.getUTCDate(),
    hour: j.getUTCHours(),
    minute: j.getUTCMinutes(),
    weekday: j.getUTCDay(),
  };
}

/** JST の壁時計 (年月日時分) から絶対時刻 (instant) を作る。 */
export function fromJst(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - JST_OFFSET_MS);
}

/** instant を JST の "YYYY-MM-DD" にする。 */
export function toDayISO(instant: Date): string {
  const p = toJstParts(instant);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** "YYYY-MM-DD" をパースする。不正値は例外。 */
export function parseDayISO(dayISO: string): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayISO);
  if (!m) throw new Error(`invalid dayISO: ${dayISO}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** "YYYY-MM-DD" (JST) のその日 00:00 の instant を返す。 */
export function dayISOToStart(dayISO: string): Date {
  const { year, month, day } = parseDayISO(dayISO);
  return fromJst(year, month, day, 0, 0);
}

/** instant の属する JST 日の 00:00 instant を返す。 */
export function startOfJstDay(instant: Date): Date {
  const p = toJstParts(instant);
  return fromJst(p.year, p.month, p.day, 0, 0);
}

/** "YYYY-MM-DD" の曜日インデックス (0=日)。 */
export function weekdayOfDayISO(dayISO: string): number {
  return toJstParts(dayISOToStart(dayISO)).weekday;
}

/** instant を JST "H:MM" にする (時は先頭ゼロなし、分は2桁)。例: 9:00, 14:30。 */
export function toHHMM(instant: Date): string {
  const p = toJstParts(instant);
  return `${p.hour}:${pad2(p.minute)}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
