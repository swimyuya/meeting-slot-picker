/**
 * Google Calendar events.list を使って表示範囲内の予定を取得する。
 *
 * freeBusy と異なりタイトル (summary) や allDay フラグが得られる。
 * 繰り返し予定は singleEvents=true で個別インスタンスに展開する。
 *
 * 既存の `src/calendar/events.ts` のロジックを provider 別ファイルに整理。
 */

import { getAccessToken, type TokenInput } from "../token";
import type { CalendarEvent } from "../types";
import { httpFetch, safeErrorBody, type HttpFetch } from "../../lib/http";

const EVENTS_BASE = "https://www.googleapis.com/calendar/v3/calendars";
const JST_OFFSET = "+09:00";

export interface GoogleEventsInput {
  auth: TokenInput;
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
}

export interface GoogleEventsDeps {
  fetchFn?: HttpFetch;
  now?: () => number;
}

interface RawItem {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export async function fetchGoogleEvents(
  input: GoogleEventsInput,
  deps: GoogleEventsDeps = {},
): Promise<CalendarEvent[]> {
  const fetchFn = deps.fetchFn ?? httpFetch;
  const token = await getAccessToken("google", input.auth, { fetchFn, now: deps.now });

  const url = new URL(`${EVENTS_BASE}/${encodeURIComponent(input.calendarId)}/events`);
  url.searchParams.set("timeMin", input.timeMin.toISOString());
  url.searchParams.set("timeMax", input.timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "250");

  const res = await fetchFn(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`events.list failed: ${res.status} ${await safeErrorBody(res)}`);
  }
  const json = (await res.json()) as { items?: RawItem[] };
  return (json.items ?? [])
    .map(toCalendarEvent)
    .filter((e): e is CalendarEvent => e !== null);
}

/** 生レスポンスを CalendarEvent に変換。allDay は date フィールド経由で判定。 */
function toCalendarEvent(item: RawItem): CalendarEvent | null {
  const startISO =
    item.start?.dateTime ??
    (item.start?.date ? `${item.start.date}T00:00:00${JST_OFFSET}` : null);
  const endISO =
    item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T00:00:00${JST_OFFSET}` : null);
  if (!startISO || !endISO || !item.id) return null;
  return {
    id: `g:${item.id}`,
    summary: item.summary ?? "(無題)",
    start: startISO,
    end: endISO,
    allDay: !item.start?.dateTime,
    source: "google",
  };
}
