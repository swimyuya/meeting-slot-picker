import { beforeEach, describe, expect, it, vi } from "vitest";

// events 経路は Tauri (Google token endpoint 直接呼び出し) を前提に検証する。
vi.mock("../lib/tauri", () => ({ isTauri: () => true }));

import { fetchEventsBetween, type EventsInput } from "../calendar/events";
import { clearTokenCache } from "../calendar/token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const input: EventsInput = {
  auth: { clientId: "cid", refreshToken: "rt" },
  calendarId: "primary",
  timeMin: new Date("2026-01-01T00:00:00Z"),
  timeMax: new Date("2026-01-02T00:00:00Z"),
};

function mockFetch(eventsResp: () => Response) {
  return vi.fn().mockImplementation((url: string) =>
    String(url).includes("/token")
      ? Promise.resolve(jsonResponse({ access_token: "at", expires_in: 3600 }))
      : Promise.resolve(eventsResp()),
  );
}

beforeEach(() => clearTokenCache());

describe("fetchEventsBetween", () => {
  it("時刻指定の予定を CalendarEvent[] で返す", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        items: [
          {
            id: "e1",
            summary: "Meeting",
            start: { dateTime: "2026-01-01T01:00:00Z" },
            end: { dateTime: "2026-01-01T02:00:00Z" },
          },
        ],
      }),
    );
    const out = await fetchEventsBetween(input, { fetchFn, now: () => 0 });
    expect(out).toEqual([
      {
        id: "e1",
        summary: "Meeting",
        start: "2026-01-01T01:00:00Z",
        end: "2026-01-01T02:00:00Z",
        allDay: false,
      },
    ]);
  });

  it("終日予定は allDay=true で JST 00:00 として返す", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        items: [
          { id: "h1", summary: "Holiday", start: { date: "2026-01-01" }, end: { date: "2026-01-02" } },
        ],
      }),
    );
    const out = await fetchEventsBetween(input, { fetchFn, now: () => 0 });
    expect(out[0]).toMatchObject({ id: "h1", summary: "Holiday", allDay: true });
    expect(out[0].start).toBe("2026-01-01T00:00:00+09:00");
    expect(out[0].end).toBe("2026-01-02T00:00:00+09:00");
  });

  it("summary 未設定は '(無題)' を入れる", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        items: [
          {
            id: "n1",
            start: { dateTime: "2026-01-01T05:00:00Z" },
            end: { dateTime: "2026-01-01T06:00:00Z" },
          },
        ],
      }),
    );
    const out = await fetchEventsBetween(input, { fetchFn, now: () => 0 });
    expect(out[0].summary).toBe("(無題)");
  });

  it("events.list URL の path と必須クエリが正しい", async () => {
    const fetchFn = mockFetch(() => jsonResponse({ items: [] }));
    await fetchEventsBetween(input, { fetchFn, now: () => 0 });
    const call = fetchFn.mock.calls.find((c) => String(c[0]).includes("/events"))!;
    const url = new URL(String(call[0]));
    expect(url.pathname).toBe("/calendar/v3/calendars/primary/events");
    expect(url.searchParams.get("singleEvents")).toBe("true");
    expect(url.searchParams.get("orderBy")).toBe("startTime");
    expect(url.searchParams.get("timeMin")).toBe(input.timeMin.toISOString());
    expect(url.searchParams.get("timeMax")).toBe(input.timeMax.toISOString());
  });

  it("非200は throw する", async () => {
    const fetchFn = mockFetch(() => new Response("err", { status: 401 }));
    await expect(fetchEventsBetween(input, { fetchFn, now: () => 0 })).rejects.toThrow(/401/);
  });
});
