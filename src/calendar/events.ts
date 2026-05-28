/**
 * 後方互換シム: 旧 `fetchEventsBetween` は providers/google.ts の `fetchGoogleEvents` を呼ぶ。
 * Pro 版コードは provider 経路 (providers/index.ts) を使う。
 */

import { fetchGoogleEvents, type GoogleEventsDeps, type GoogleEventsInput } from "./providers/google";
import type { CalendarEvent } from "./types";

export type EventsInput = GoogleEventsInput;
export type EventsDeps = GoogleEventsDeps;

export async function fetchEventsBetween(
  input: EventsInput,
  deps: EventsDeps = {},
): Promise<CalendarEvent[]> {
  return fetchGoogleEvents(input, deps);
}
