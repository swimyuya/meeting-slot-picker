/**
 * Apple iCloud Calendar (CalDAV) クライアント。
 *
 * tsdav で iCloud にログインし、全カレンダーからイベントを取得する。
 * node-ical で VCALENDAR/VEVENT を parse し、繰り返し予定 (RRULE) は時間範囲で展開。
 *
 * セキュリティ:
 *   - Apple ID メールとアプリ用パスワードを受け取って iCloud に Basic 認証
 *   - サーバ側で credential を保持しない (リクエスト毎に受け取る)
 *   - 認証失敗時は素直に 401 を上に返す
 *
 * iCloud CalDAV のクセ:
 *   - serverUrl は https://caldav.icloud.com
 *   - defaultAccountType: "caldav"
 *   - expand を渡してもサーバ側展開がされないことがあるので、クライアント側で
 *     rrule で展開しなおす
 */

// tsdav: package.json に "type": "module" が無いため Node ESM で .esm.js を読むと
// CJS として解釈されて syntax error になる。createRequire で CJS 経由 (main =
// dist/tsdav.cjs.js) で強制ロードしてバイパスする。
import { createRequire } from "module";
import * as ical from "node-ical";

const requireCjs = createRequire(import.meta.url);
const tsdavCjs = requireCjs("tsdav") as typeof import("tsdav");
const { createDAVClient } = tsdavCjs;

export interface AppleEventRaw {
  id: string;
  summary: string;
  /** ISO 文字列 (JST +09:00 補完済) */
  start: string;
  end: string;
  allDay: boolean;
}

export interface FetchICloudEventsArgs {
  email: string;
  appPassword: string;
  timeMin: Date;
  timeMax: Date;
}

/** iCloud CalDAV から指定期間の予定を取得する。 */
export async function fetchICloudEvents(
  args: FetchICloudEventsArgs,
): Promise<AppleEventRaw[]> {
  // tsdav v2 は createDAVClient (関数) を使う。createDAVClient 内で login も行われる
  const client = await createDAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username: args.email, password: args.appPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });

  const calendars = await client.fetchCalendars();
  // VEVENT を持つカレンダーのみ (誕生日・リマインダー等は除外)
  const eventCalendars = calendars.filter((c) =>
    Array.isArray(c.components)
      ? c.components.includes("VEVENT")
      : true,
  );

  const all: AppleEventRaw[] = [];
  for (const cal of eventCalendars) {
    const objects = await client.fetchCalendarObjects({
      calendar: cal,
      timeRange: {
        start: args.timeMin.toISOString(),
        end: args.timeMax.toISOString(),
      },
      expand: true,
    });
    for (const obj of objects) {
      if (!obj.data || typeof obj.data !== "string") continue;
      try {
        const events = parseAndExpand(obj.data, args.timeMin, args.timeMax);
        all.push(...events);
      } catch {
        // 単一カレンダーオブジェクトの parse 失敗は無視 (全体は続行)
      }
    }
  }
  return all;
}

/** iCal データを parse し、RRULE は範囲内のオカレンスに展開する。 */
export function parseAndExpand(
  icalData: string,
  timeMin: Date,
  timeMax: Date,
): AppleEventRaw[] {
  const parsed = ical.sync.parseICS(icalData);
  const results: AppleEventRaw[] = [];
  for (const k of Object.keys(parsed)) {
    const item = parsed[k];
    if (!item || item.type !== "VEVENT") continue;
    const vevent = item;

    const summary = String(vevent.summary ?? "(無題)");
    const uid = String(vevent.uid ?? k);

    // 繰り返しがある場合: rrule で範囲内のオカレンスを生成
    if (vevent.rrule) {
      try {
        const occurrences = vevent.rrule.between(timeMin, timeMax, true);
        for (const occStart of occurrences) {
          const startDate = occStart as Date;
          const durationMs =
            ((vevent.end as Date)?.getTime?.() ?? startDate.getTime()) -
            ((vevent.start as Date)?.getTime?.() ?? startDate.getTime());
          const endDate = new Date(startDate.getTime() + Math.max(0, durationMs));
          results.push(makeEvent(uid + ":" + startDate.toISOString(), summary, startDate, endDate, isAllDay(vevent)));
        }
        continue;
      } catch {
        // rrule 展開に失敗したら単発として扱う (フォールバック)
      }
    }

    // 単発予定: 範囲外をスキップ
    const start = vevent.start instanceof Date ? vevent.start : new Date(String(vevent.start));
    const end = vevent.end instanceof Date ? vevent.end : new Date(String(vevent.end));
    if (!isFinite(start.getTime()) || !isFinite(end.getTime())) continue;
    if (end <= timeMin || start >= timeMax) continue;

    results.push(makeEvent(uid, summary, start, end, isAllDay(vevent)));
  }
  return results;
}

function isAllDay(vevent: ical.VEvent): boolean {
  // node-ical は終日予定の場合 datetype が "date"、それ以外は "date-time"
  const t = (vevent as unknown as { datetype?: string }).datetype;
  if (t === "date") return true;
  // フォールバック: start が 00:00:00 と思しき場合
  const s = vevent.start instanceof Date ? vevent.start : null;
  if (!s) return false;
  return s.getUTCHours() === 0 && s.getUTCMinutes() === 0 && s.getUTCSeconds() === 0;
}

function makeEvent(
  id: string,
  summary: string,
  start: Date,
  end: Date,
  allDay: boolean,
): AppleEventRaw {
  return {
    id,
    summary,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
  };
}
