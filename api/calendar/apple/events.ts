/**
 * Vercel Function: POST /api/calendar/apple/events
 * 入力: { email, app_password, time_min, time_max }
 * 出力: { events: CalendarEvent[] }
 *
 * Apple iCloud Calendar (CalDAV) から指定期間の予定を取得する。
 * 認証失敗時は 401、それ以外のエラーは 500 を返す。
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { applyCors } from "../../_lib/cors.js";
import { fetchICloudEvents, type AppleEventRaw } from "../../_lib/apple-caldav.js";

const BodySchema = z.object({
  email: z.string().email().max(254),
  app_password: z.string().min(8).max(64),
  time_min: z.string().datetime(),
  time_max: z.string().datetime(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    return;
  }

  const { email, app_password, time_min, time_max } = parsed.data;
  const timeMin = new Date(time_min);
  const timeMax = new Date(time_max);

  try {
    const raw: AppleEventRaw[] = await fetchICloudEvents({
      email,
      appPassword: app_password,
      timeMin,
      timeMax,
    });
    const events = raw.map((e) => ({
      id: `apple:${e.id}`,
      summary: e.summary,
      start: e.start,
      end: e.end,
      allDay: e.allDay,
      source: "apple" as const,
    }));
    res.status(200).json({ events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[/api/calendar/apple/events]", msg);
    // tsdav は認証失敗を様々なメッセージで表現する:
    //   - "401", "403", "Unauthorized"
    //   - "cannot find principalUrl" (iCloud が credential を拒否したとき)
    //   - "invalid" 系
    if (/401|403|unauthor|invalid|principal/i.test(msg)) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }
    res.status(500).json({ error: "caldav_failed" });
  }
}
