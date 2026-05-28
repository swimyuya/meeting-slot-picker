/**
 * Microsoft Graph /me/calendarView のレスポンスマッピング検証。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri", () => ({ isTauri: () => true }));

import { fetchMicrosoftEvents } from "../calendar/providers/microsoft";
import { clearTokenCache } from "../calendar/token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => clearTokenCache());

const auth = { clientId: "ms-cid", refreshToken: "ms-rt" };
const input = {
  auth,
  timeMin: new Date("2026-01-01T00:00:00Z"),
  timeMax: new Date("2026-01-02T00:00:00Z"),
};

function mockFetch(eventsResp: () => Response) {
  return vi.fn().mockImplementation((url: string) =>
    String(url).includes("/oauth2/v2.0/token")
      ? Promise.resolve(jsonResponse({ access_token: "ms-at", expires_in: 3600 }))
      : Promise.resolve(eventsResp()),
  );
}

describe("fetchMicrosoftEvents", () => {
  it("時刻指定の予定を CalendarEvent (source=microsoft) で返す", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        value: [
          {
            id: "ABC123",
            subject: "予算会議",
            start: { dateTime: "2026-01-01T10:00:00.0000000", timeZone: "Tokyo Standard Time" },
            end: { dateTime: "2026-01-01T11:00:00.0000000", timeZone: "Tokyo Standard Time" },
            isAllDay: false,
          },
        ],
      }),
    );
    const out = await fetchMicrosoftEvents(input, { fetchFn, now: () => 0 });
    expect(out).toEqual([
      {
        id: "ms:ABC123",
        summary: "予算会議",
        start: "2026-01-01T10:00:00.0000000+09:00",
        end: "2026-01-01T11:00:00.0000000+09:00",
        allDay: false,
        source: "microsoft",
      },
    ]);
  });

  it("終日予定は allDay=true でマップされる", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        value: [
          {
            id: "AD1",
            subject: "終日打ち合わせ",
            start: { dateTime: "2026-01-01T00:00:00.0000000", timeZone: "UTC" },
            end: { dateTime: "2026-01-02T00:00:00.0000000", timeZone: "UTC" },
            isAllDay: true,
          },
        ],
      }),
    );
    const out = await fetchMicrosoftEvents(input, { fetchFn, now: () => 0 });
    expect(out[0]).toMatchObject({
      id: "ms:AD1",
      summary: "終日打ち合わせ",
      allDay: true,
      source: "microsoft",
    });
  });

  it("subject 未設定は '(無題)' を入れる", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        value: [
          {
            id: "X",
            start: { dateTime: "2026-01-01T05:00:00.0000000", timeZone: "Tokyo Standard Time" },
            end: { dateTime: "2026-01-01T06:00:00.0000000", timeZone: "Tokyo Standard Time" },
          },
        ],
      }),
    );
    const out = await fetchMicrosoftEvents(input, { fetchFn, now: () => 0 });
    expect(out[0].summary).toBe("(無題)");
  });

  it("Prefer: outlook.timezone=\"Tokyo Standard Time\" ヘッダを付与する", async () => {
    const fetchFn = mockFetch(() => jsonResponse({ value: [] }));
    await fetchMicrosoftEvents(input, { fetchFn, now: () => 0 });
    const calendarCall = fetchFn.mock.calls.find((c) =>
      String(c[0]).includes("calendarView"),
    )!;
    const headers = calendarCall[1].headers as Record<string, string>;
    expect(headers.Prefer).toBe('outlook.timezone="Tokyo Standard Time"');
    expect(headers.Authorization).toBe("Bearer ms-at");
  });

  it("非200 は throw する", async () => {
    const fetchFn = mockFetch(() => new Response("err", { status: 401 }));
    await expect(
      fetchMicrosoftEvents(input, { fetchFn, now: () => 0 }),
    ).rejects.toThrow(/401/);
  });
});
