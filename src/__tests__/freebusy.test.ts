import { beforeEach, describe, expect, it, vi } from "vitest";

// freeBusy 経路は Tauri (Google token endpoint 直接呼び出し) を前提に検証する。
vi.mock("../lib/tauri", () => ({ isTauri: () => true }));

import { fetchBusyBetween, type FreeBusyInput } from "../calendar/freebusy";
import { clearTokenCache } from "../calendar/token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const input: FreeBusyInput = {
  auth: { clientId: "cid", refreshToken: "rt" },
  calendarId: "primary",
  timeZone: "Asia/Tokyo",
  timeMin: new Date("2026-01-01T00:00:00Z"),
  timeMax: new Date("2026-01-02T00:00:00Z"),
};

/** /token は access_token を、それ以外 (freeBusy) は指定 busy を返すモック。 */
function mockFetch(busyResponder: () => Response) {
  return vi.fn().mockImplementation((url: string) =>
    String(url).includes("/token")
      ? Promise.resolve(jsonResponse({ access_token: "at", expires_in: 3600 }))
      : Promise.resolve(busyResponder()),
  );
}

beforeEach(() => clearTokenCache());

describe("fetchBusyBetween", () => {
  it("busy 区間を取得して返す", async () => {
    const busy = [{ start: "2026-01-01T01:00:00Z", end: "2026-01-01T02:00:00Z" }];
    const fetchFn = mockFetch(() => jsonResponse({ calendars: { primary: { busy } } }));
    const out = await fetchBusyBetween(input, { fetchFn, now: () => 0 });
    expect(out).toEqual(busy);
  });

  it("freeBusy リクエストの body と認証ヘッダが正しい", async () => {
    const fetchFn = mockFetch(() => jsonResponse({ calendars: { primary: { busy: [] } } }));
    await fetchBusyBetween(input, { fetchFn, now: () => 0 });
    const call = fetchFn.mock.calls.find((c) => String(c[0]).includes("freeBusy"))!;
    const body = JSON.parse(call[1].body as string);
    expect(body).toMatchObject({
      timeMin: "2026-01-01T00:00:00.000Z",
      timeMax: "2026-01-02T00:00:00.000Z",
      timeZone: "Asia/Tokyo",
      items: [{ id: "primary" }],
    });
    expect((call[1].headers as Record<string, string>).Authorization).toBe("Bearer at");
  });

  it("busy が無ければ空配列を返す", async () => {
    const fetchFn = mockFetch(() => jsonResponse({ calendars: {} }));
    const out = await fetchBusyBetween(input, { fetchFn, now: () => 0 });
    expect(out).toEqual([]);
  });

  it("freeBusy 非200は throw する", async () => {
    const fetchFn = mockFetch(() => new Response("err", { status: 500 }));
    await expect(fetchBusyBetween(input, { fetchFn, now: () => 0 })).rejects.toThrow(/500/);
  });

  it("応答キーが email など primary と異なる場合もフォールバックで取得する", async () => {
    const busy = [{ start: "2026-01-01T01:00:00Z", end: "2026-01-01T02:00:00Z" }];
    // primary 指定だが応答は email キー
    const fetchFn = mockFetch(() => jsonResponse({ calendars: { "u@example.com": { busy } } }));
    const out = await fetchBusyBetween(input, { fetchFn, now: () => 0 });
    expect(out).toEqual(busy);
  });

  it("カレンダー単位のエラー (calendars.x.errors) は throw する", async () => {
    const fetchFn = mockFetch(() =>
      jsonResponse({
        calendars: { primary: { errors: [{ domain: "global", reason: "notFound" }], busy: [] } },
      }),
    );
    await expect(fetchBusyBetween(input, { fetchFn, now: () => 0 })).rejects.toThrow(/notFound/);
  });
});
