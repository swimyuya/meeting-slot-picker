import { useCallback, useEffect, useRef, useState } from "react";
import { isOAuthProvider, type ProviderId } from "../auth/providers";
import { fetchEventsForProvider } from "../calendar/providers";
import { isAuthExpiredError } from "../calendar/token";
import type { CalendarEvent } from "../calendar/types";
import type { AppConfig } from "../lib/config";
import { getOAuthClientCredentials } from "../lib/env";
import { errMessage } from "../lib/error";
import { getAppleCredentials, getRefreshToken } from "../lib/secrets";
import { DAY_MS, startOfJstDay } from "../lib/time";
import type { ConnectedState, ProviderError } from "./useProviderStatus";

/**
 * 接続中の provider 全てに対し、表示範囲の予定を並列 fetch して merge するフック。
 * 片方が失敗してももう一方は表示する。エラーは provider 別に保持。
 * Apple は CalDAV (Vercel Function) 経由で取得する。
 */
export function useBusyTimes(
  connected: ConnectedState,
  config: AppConfig,
  now: Date,
  onAuthExpired?: (provider: ProviderId) => void,
) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<ProviderError>({});
  const { daysAhead, calendarId } = config;

  // reload を再生成せずに最新のコールバックを参照するため ref に退避する。
  const onAuthExpiredRef = useRef(onAuthExpired);
  useEffect(() => {
    onAuthExpiredRef.current = onAuthExpired;
  }, [onAuthExpired]);

  const reload = useCallback(async () => {
    const targets: ProviderId[] = [];
    if (connected.google === true) targets.push("google");
    if (connected.microsoft === true) targets.push("microsoft");
    if (connected.apple === true) targets.push("apple");

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
      if (provider === "apple") {
        // Apple: credentials を取得して dispatch (auth 不要、providers/apple.ts が
        // /api/calendar/apple/events を呼ぶ)
        const creds = await getAppleCredentials();
        if (!creds) return { provider, events: [] as CalendarEvent[] };
        const fetched = await fetchEventsForProvider({
          provider,
          // OAuth 経路では使わないが型の都合上ダミーを渡す
          auth: { clientId: "", refreshToken: "" },
          timeMin,
          timeMax,
        });
        return { provider, events: fetched };
      }
      // OAuth provider (Google / Microsoft)
      if (!isOAuthProvider(provider)) return { provider, events: [] as CalendarEvent[] };
      const refreshToken = await getRefreshToken(provider);
      if (!refreshToken) return { provider, events: [] as CalendarEvent[] };
      const fetched = await fetchEventsForProvider({
        provider,
        auth: { ...getOAuthClientCredentials(provider), refreshToken },
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
      } else if (isAuthExpiredError(r.reason)) {
        // refresh_token 失効: 親に通知して再連携フローへ誘導する。
        onAuthExpiredRef.current?.(p);
        errs[p] = "連携の有効期限が切れました。再連携してください。";
      } else {
        errs[p] = errMessage(r.reason);
      }
    }
    setEvents(merged);
    setErrors(errs);
    setLoading(false);
  }, [
    connected.google,
    connected.microsoft,
    connected.apple,
    daysAhead,
    calendarId,
    now,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { events, loading, errors, reload };
}
