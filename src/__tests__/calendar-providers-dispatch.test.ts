/**
 * fetchEventsForProvider の provider 別 dispatch を固定する。
 * 各 fetcher 本体は events / microsoft-events / apple-connect の各テストでカバー済み。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../calendar/providers/apple", () => ({
  fetchAppleEvents: vi.fn(async () => [{ id: "apple:1" }]),
}));
vi.mock("../calendar/providers/google", () => ({
  fetchGoogleEvents: vi.fn(async () => [{ id: "g:1" }]),
}));
vi.mock("../calendar/providers/microsoft", () => ({
  fetchMicrosoftEvents: vi.fn(async () => [{ id: "ms:1" }]),
}));
vi.mock("../lib/secrets", () => ({
  getAppleCredentials: vi.fn(
    async (): Promise<{ email: string; password: string } | null> => null,
  ),
}));

import { fetchEventsForProvider } from "../calendar/providers";
import { fetchAppleEvents } from "../calendar/providers/apple";
import { fetchGoogleEvents } from "../calendar/providers/google";
import { fetchMicrosoftEvents } from "../calendar/providers/microsoft";
import { getAppleCredentials } from "../lib/secrets";

const auth = { clientId: "cid", refreshToken: "rt" };
const timeMin = new Date("2026-01-01T00:00:00Z");
const timeMax = new Date("2026-01-08T00:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchEventsForProvider", () => {
  it("google: calendarId 未指定は primary を補って fetchGoogleEvents へ", async () => {
    const result = await fetchEventsForProvider({ provider: "google", auth, timeMin, timeMax });
    expect(fetchGoogleEvents).toHaveBeenCalledWith(
      { auth, calendarId: "primary", timeMin, timeMax },
      {},
    );
    expect(result).toEqual([{ id: "g:1" }]);
  });

  it("google: 明示 calendarId と deps はそのまま渡す", async () => {
    const fetchFn = vi.fn();
    await fetchEventsForProvider(
      { provider: "google", auth, calendarId: "work@example.com", timeMin, timeMax },
      { fetchFn },
    );
    expect(fetchGoogleEvents).toHaveBeenCalledWith(
      { auth, calendarId: "work@example.com", timeMin, timeMax },
      { fetchFn },
    );
  });

  it("microsoft: auth と deps を素通しする (calendarId は渡さない)", async () => {
    const fetchFn = vi.fn();
    const result = await fetchEventsForProvider(
      { provider: "microsoft", auth, timeMin, timeMax },
      { fetchFn },
    );
    expect(fetchMicrosoftEvents).toHaveBeenCalledWith({ auth, timeMin, timeMax }, { fetchFn });
    expect(result).toEqual([{ id: "ms:1" }]);
  });

  it("apple: 資格情報があれば fetchAppleEvents へ (fetchFn のみ渡す)", async () => {
    const credentials = { email: "a@example.com", password: "abcd1234" };
    vi.mocked(getAppleCredentials).mockResolvedValueOnce(credentials);
    const fetchFn = vi.fn();
    const result = await fetchEventsForProvider(
      { provider: "apple", auth, timeMin, timeMax },
      { fetchFn },
    );
    expect(fetchAppleEvents).toHaveBeenCalledWith(
      { credentials, timeMin, timeMax },
      { fetchFn },
    );
    expect(result).toEqual([{ id: "apple:1" }]);
  });

  it("apple: 資格情報が無ければ空配列を返し fetcher は呼ばない", async () => {
    vi.mocked(getAppleCredentials).mockResolvedValueOnce(null);
    const result = await fetchEventsForProvider({ provider: "apple", auth, timeMin, timeMax });
    expect(result).toEqual([]);
    expect(fetchAppleEvents).not.toHaveBeenCalled();
  });
});
