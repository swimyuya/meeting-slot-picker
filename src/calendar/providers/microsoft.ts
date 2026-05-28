/**
 * Microsoft Graph /me/calendarView で表示範囲内の Outlook 予定を取得する。
 *
 * - `startDateTime` / `endDateTime` クエリで期間指定 (繰り返し予定は展開済の instances)
 * - `Prefer: outlook.timezone="Tokyo Standard Time"` ヘッダで JST に変換させる
 * - 時刻 dateTime に +09:00 を付与して安全に Date.parse できる ISO に整える
 * - allDay は `isAllDay` boolean
 *
 * id に `ms:` プレフィックスを付けて Google の id と衝突回避。
 */

import { httpFetch, safeErrorBody, type HttpFetch } from "../../lib/http";
import { getAccessToken, type TokenInput } from "../token";
import type { CalendarEvent } from "../types";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const JST_OFFSET = "+09:00";

export interface MicrosoftEventsInput {
  auth: TokenInput;
  timeMin: Date;
  timeMax: Date;
}

export interface MicrosoftEventsDeps {
  fetchFn?: HttpFetch;
  now?: () => number;
}

interface MsDateTime {
  dateTime?: string;
  timeZone?: string;
}

interface MsEvent {
  id?: string;
  subject?: string;
  start?: MsDateTime;
  end?: MsDateTime;
  isAllDay?: boolean;
}

export async function fetchMicrosoftEvents(
  input: MicrosoftEventsInput,
  deps: MicrosoftEventsDeps = {},
): Promise<CalendarEvent[]> {
  const fetchFn = deps.fetchFn ?? httpFetch;
  const token = await getAccessToken("microsoft", input.auth, { fetchFn, now: deps.now });

  const url = new URL(`${GRAPH_BASE}/me/calendarView`);
  url.searchParams.set("startDateTime", input.timeMin.toISOString());
  url.searchParams.set("endDateTime", input.timeMax.toISOString());
  url.searchParams.set("$orderby", "start/dateTime");
  url.searchParams.set("$top", "250");

  const res = await fetchFn(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.timezone="Tokyo Standard Time"',
    },
  });
  if (!res.ok) {
    throw new Error(`graph calendarView failed: ${res.status} ${await safeErrorBody(res)}`);
  }
  const json = (await res.json()) as { value?: MsEvent[] };
  return (json.value ?? [])
    .map(toCalendarEvent)
    .filter((e): e is CalendarEvent => e !== null);
}

/** Microsoft Graph の event を共通 CalendarEvent 型へ変換。 */
function toCalendarEvent(item: MsEvent): CalendarEvent | null {
  if (!item.id || !item.start?.dateTime || !item.end?.dateTime) return null;
  return {
    id: `ms:${item.id}`,
    summary: item.subject ?? "(無題)",
    // Prefer header で JST 化しているので +09:00 を補完して ISO 8601 に整える
    start: ensureOffset(item.start.dateTime),
    end: ensureOffset(item.end.dateTime),
    allDay: Boolean(item.isAllDay),
    source: "microsoft",
  };
}

/** dateTime 末尾にタイムゾーン指定が無い場合 +09:00 を付ける。 */
function ensureOffset(dt: string): string {
  // 既に Z や +HH:MM が付いていればそのまま
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(dt)) return dt;
  return `${dt}${JST_OFFSET}`;
}
