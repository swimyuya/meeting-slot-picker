/**
 * Provider 別の calendar fetch を集約。
 */

import type { ProviderId } from "../../auth/providers";
import type { HttpFetch } from "../../lib/http";
import type { TokenInput } from "../token";
import type { CalendarEvent } from "../types";
import { fetchGoogleEvents } from "./google";
import { fetchMicrosoftEvents } from "./microsoft";

export interface FetchEventsInput {
  provider: ProviderId;
  auth: TokenInput;
  /** Google 用カレンダー ID (microsoft では無視)。 */
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
}

export interface FetchEventsDeps {
  fetchFn?: HttpFetch;
  now?: () => number;
}

export async function fetchEventsForProvider(
  input: FetchEventsInput,
  deps: FetchEventsDeps = {},
): Promise<CalendarEvent[]> {
  if (input.provider === "microsoft") {
    return fetchMicrosoftEvents(
      { auth: input.auth, timeMin: input.timeMin, timeMax: input.timeMax },
      deps,
    );
  }
  return fetchGoogleEvents(
    {
      auth: input.auth,
      calendarId: input.calendarId ?? "primary",
      timeMin: input.timeMin,
      timeMax: input.timeMax,
    },
    deps,
  );
}

export { fetchGoogleEvents } from "./google";
export { fetchMicrosoftEvents } from "./microsoft";
