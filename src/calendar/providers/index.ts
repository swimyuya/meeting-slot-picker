/**
 * Provider 別の calendar fetch を集約。
 */

import type { ProviderId } from "../../auth/providers";
import type { HttpFetch } from "../../lib/http";
import { getAppleCredentials } from "../../lib/secrets";
import type { TokenInput } from "../token";
import type { CalendarEvent } from "../types";
import { fetchAppleEvents } from "./apple";
import { fetchGoogleEvents } from "./google";
import { fetchMicrosoftEvents } from "./microsoft";

export interface FetchEventsInput {
  provider: ProviderId;
  /** OAuth provider 用認証情報 (Apple では未使用)。 */
  auth: TokenInput;
  /** Google 用カレンダー ID (microsoft / apple では無視)。 */
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
}

export interface FetchEventsDeps {
  fetchFn?: HttpFetch;
  now?: () => number;
}

type ProviderFetcher = (
  input: FetchEventsInput,
  deps: FetchEventsDeps,
) => Promise<CalendarEvent[]>;

/** provider spec レジストリ (auth/providers) と同じ Record ディスパッチ方式。 */
const FETCHERS: Readonly<Record<ProviderId, ProviderFetcher>> = {
  google: (input, deps) =>
    fetchGoogleEvents(
      {
        auth: input.auth,
        calendarId: input.calendarId ?? "primary",
        timeMin: input.timeMin,
        timeMax: input.timeMax,
      },
      deps,
    ),
  microsoft: (input, deps) =>
    fetchMicrosoftEvents(
      { auth: input.auth, timeMin: input.timeMin, timeMax: input.timeMax },
      deps,
    ),
  apple: async (input, deps) => {
    const credentials = await getAppleCredentials();
    if (!credentials) return [];
    return fetchAppleEvents(
      { credentials, timeMin: input.timeMin, timeMax: input.timeMax },
      { fetchFn: deps.fetchFn },
    );
  },
};

export async function fetchEventsForProvider(
  input: FetchEventsInput,
  deps: FetchEventsDeps = {},
): Promise<CalendarEvent[]> {
  return FETCHERS[input.provider](input, deps);
}

export { fetchAppleEvents } from "./apple";
export { fetchGoogleEvents } from "./google";
export { fetchMicrosoftEvents } from "./microsoft";
