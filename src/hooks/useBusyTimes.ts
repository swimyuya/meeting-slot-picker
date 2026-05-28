import { useCallback, useEffect, useState } from "react";
import { fetchEventsBetween } from "../calendar/events";
import type { CalendarEvent } from "../calendar/types";
import type { AppConfig } from "../lib/config";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../lib/env";
import { errMessage } from "../lib/error";
import { getRefreshToken } from "../lib/secrets";
import { DAY_MS, startOfJstDay } from "../lib/time";

/** 表示範囲の予定を Google カレンダー (events.list) から取得するフック。 */
export function useBusyTimes(connected: boolean, config: AppConfig, now: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { daysAhead, calendarId } = config;

  const reload = useCallback(async () => {
    if (!connected || !GOOGLE_CLIENT_ID) {
      setEvents([]);
      return;
    }
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      setEvents([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const timeMin = startOfJstDay(now);
      const timeMax = new Date(timeMin.getTime() + daysAhead * DAY_MS);
      const result = await fetchEventsBetween({
        auth: {
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          refreshToken,
        },
        calendarId,
        timeMin,
        timeMax,
      });
      setEvents(result);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [connected, daysAhead, calendarId, now]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, loading, error, reload };
}
