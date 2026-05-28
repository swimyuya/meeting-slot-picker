import { useCallback, useEffect, useState } from "react";
import type { ProviderId } from "../auth/providers";
import { fetchEventsForProvider } from "../calendar/providers";
import type { CalendarEvent } from "../calendar/types";
import type { AppConfig } from "../lib/config";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET,
} from "../lib/env";
import { errMessage } from "../lib/error";
import { getRefreshToken } from "../lib/secrets";
import { DAY_MS, startOfJstDay } from "../lib/time";
import type { ConnectedState, ProviderError } from "./useProviderStatus";

/**
 * 接続中の provider 全てに対し、表示範囲の予定を並列 fetch して merge するフック。
 * 片方が失敗してももう一方は表示する。エラーは provider 別に保持。
 */
export function useBusyTimes(connected: ConnectedState, config: AppConfig, now: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ProviderError>({});
  const { daysAhead, calendarId } = config;

  const reload = useCallback(async () => {
    const targets: ProviderId[] = [];
    if (connected.google === true) targets.push("google");
    if (connected.microsoft === true) targets.push("microsoft");

    if (targets.length === 0) {
      setEvents([]);
      setErrors({});
      return;
    }

    setLoading(true);
    setErrors({});
    const timeMin = startOfJstDay(now);
    const timeMax = new Date(timeMin.getTime() + daysAhead * DAY_MS);

    const tasks = targets.map(async (provider) => {
      const refreshToken = await getRefreshToken(provider);
      if (!refreshToken) return { provider, events: [] as CalendarEvent[] };
      const clientId = provider === "google" ? GOOGLE_CLIENT_ID : MICROSOFT_CLIENT_ID;
      const clientSecret =
        provider === "google" ? GOOGLE_CLIENT_SECRET : MICROSOFT_CLIENT_SECRET;
      const fetched = await fetchEventsForProvider({
        provider,
        auth: { clientId, clientSecret, refreshToken },
        calendarId,
        timeMin,
        timeMax,
      });
      return { provider, events: fetched };
    });

    const results = await Promise.allSettled(tasks);
    const merged: CalendarEvent[] = [];
    const errs: ProviderError = {};
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const p = targets[i];
      if (r.status === "fulfilled") {
        merged.push(...r.value.events);
      } else {
        errs[p] = errMessage(r.reason);
      }
    }
    setEvents(merged);
    setErrors(errs);
    setLoading(false);
  }, [connected.google, connected.microsoft, daysAhead, calendarId, now]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, loading, errors, reload };
}
