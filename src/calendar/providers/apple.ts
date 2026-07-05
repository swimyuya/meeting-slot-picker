/**
 * Apple Calendar (iCloud CalDAV) クライアント側 fetcher。
 *
 * バックエンドの /api/calendar/apple/events に credentials と時間範囲を POST し、
 * CalendarEvent[] (source: "apple") を受け取る。
 */

import { getApiBaseUrl } from "../../lib/env";
import { httpFetch, type HttpFetch } from "../../lib/http";
import type { AppleCredentials } from "../../lib/secrets";
import type { CalendarEvent } from "../types";

/** Apple イベント取得 API のパス (apple-connect.ts の接続テストも同じ endpoint を使う)。 */
export const APPLE_EVENTS_PATH = "/api/calendar/apple/events";

export interface AppleEventsInput {
  credentials: AppleCredentials;
  timeMin: Date;
  timeMax: Date;
}

export interface AppleEventsDeps {
  fetchFn?: HttpFetch;
}

export async function fetchAppleEvents(
  input: AppleEventsInput,
  deps: AppleEventsDeps = {},
): Promise<CalendarEvent[]> {
  const fetchFn = deps.fetchFn ?? httpFetch;
  const url = `${getApiBaseUrl()}${APPLE_EVENTS_PATH}`;
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: input.credentials.email,
      app_password: input.credentials.password,
      time_min: input.timeMin.toISOString(),
      time_max: input.timeMax.toISOString(),
    }),
  });
  if (res.status === 401) {
    throw new Error(
      "Apple のアプリ用パスワードが無効です。再連携してください。",
    );
  }
  if (!res.ok) {
    throw new Error(`apple events fetch failed: ${res.status}`);
  }
  const json = (await res.json()) as { events: CalendarEvent[] };
  // 念のため source を付与し直す (バックエンドで付与済だが万一の保険)
  return json.events.map((e) => ({ ...e, source: "apple" as const }));
}
