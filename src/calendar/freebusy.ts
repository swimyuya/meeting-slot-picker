/**
 * Google Calendar v3 freeBusy で busy 区間を取得する。
 * line-reply-drafter/backend/src/services/calendar.ts の fetchBusyBetween を移植。
 */

import { httpFetch, safeErrorBody, type HttpFetch } from "../lib/http";
import { getAccessToken, type TokenInput } from "./token";
import type { BusySlot } from "./types";

const FREEBUSY_ENDPOINT = "https://www.googleapis.com/calendar/v3/freeBusy";

export interface FreeBusyInput {
  auth: TokenInput;
  calendarId: string;
  timeZone: string;
  timeMin: Date;
  timeMax: Date;
}

export interface FreeBusyDeps {
  fetchFn?: HttpFetch;
  now?: () => number;
}

export async function fetchBusyBetween(
  input: FreeBusyInput,
  deps: FreeBusyDeps = {},
): Promise<BusySlot[]> {
  const fetchFn = deps.fetchFn ?? httpFetch;
  const token = await getAccessToken(input.auth, { fetchFn, now: deps.now });

  const res = await fetchFn(FREEBUSY_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: input.timeMin.toISOString(),
      timeMax: input.timeMax.toISOString(),
      timeZone: input.timeZone,
      items: [{ id: input.calendarId }],
    }),
  });
  if (!res.ok) {
    throw new Error(`freeBusy failed: ${res.status} ${await safeErrorBody(res)}`);
  }
  const json = (await res.json()) as {
    calendars?: Record<
      string,
      { busy?: BusySlot[]; errors?: Array<{ domain?: string; reason?: string }> }
    >;
  };
  // Google は primary 指定でも応答キーを email にして返すことがある。
  // 対象キーが無ければ最初のカレンダー応答を採用する。
  const calendars = json.calendars ?? {};
  const calKeys = Object.keys(calendars);
  const target = calendars[input.calendarId] ?? (calKeys[0] ? calendars[calKeys[0]] : undefined);
  // カレンダー単位のエラー (notFound・権限不足など) は握り潰さず surface する。
  if (target?.errors && target.errors.length > 0) {
    throw new Error(`freeBusy calendar error: ${JSON.stringify(target.errors)}`);
  }
  return target?.busy ?? [];
}
