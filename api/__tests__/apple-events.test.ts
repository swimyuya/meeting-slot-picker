/**
 * Vercel function /api/calendar/apple/events のハンドラ単体テスト。
 *
 * tsdav の DAVClient は mock (実際の iCloud には接続しない)。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env.ALLOWED_ORIGIN = "https://meeting-slot-picker-pro.vercel.app";
  process.env.ALLOWED_REDIRECT_URIS =
    "https://meeting-slot-picker-pro.vercel.app/auth/callback";
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    body: undefined as unknown,
    headersSet: headers,
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  } as unknown as VercelResponse & {
    statusCode: number;
    body: unknown;
    headersSet: Record<string, string>;
  };
}

describe("/api/calendar/apple/events", () => {
  it("GET は 405", async () => {
    const handler = (await import("../calendar/apple/events")).default;
    const req = { method: "GET", headers: {}, body: undefined } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(405);
  });

  it("body が不正なら 400", async () => {
    const handler = (await import("../calendar/apple/events")).default;
    const req = {
      method: "POST",
      headers: { origin: "https://meeting-slot-picker-pro.vercel.app" },
      body: { email: "invalid" },
    } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(400);
  });

  it("正常系: caldav からの結果を source=apple で返す", async () => {
    vi.doMock("../_lib/apple-caldav.js", () => ({
      fetchICloudEvents: vi.fn(async () => [
        {
          id: "abc",
          summary: "テスト予定",
          start: "2026-05-29T10:00:00.000Z",
          end: "2026-05-29T11:00:00.000Z",
          allDay: false,
        },
      ]),
    }));

    const handler = (await import("../calendar/apple/events")).default;
    const req = {
      method: "POST",
      headers: { origin: "https://meeting-slot-picker-pro.vercel.app" },
      body: {
        email: "u@example.com",
        app_password: "abcdefghijklmnop",
        time_min: "2026-05-28T00:00:00.000Z",
        time_max: "2026-05-29T00:00:00.000Z",
      },
    } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(200);
    const body = (res as unknown as { body: { events: Array<{ source: string }> } }).body;
    expect(body.events).toHaveLength(1);
    expect(body.events[0].source).toBe("apple");
  });

  it("CalDAV 401 を 401 に変換する", async () => {
    vi.doMock("../_lib/apple-caldav.js", () => ({
      fetchICloudEvents: vi.fn(async () => {
        throw new Error("Request failed with status 401");
      }),
    }));

    const handler = (await import("../calendar/apple/events")).default;
    const req = {
      method: "POST",
      headers: { origin: "https://meeting-slot-picker-pro.vercel.app" },
      body: {
        email: "u@example.com",
        app_password: "abcdefghijklmnop",
        time_min: "2026-05-28T00:00:00.000Z",
        time_max: "2026-05-29T00:00:00.000Z",
      },
    } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(401);
  });
});
