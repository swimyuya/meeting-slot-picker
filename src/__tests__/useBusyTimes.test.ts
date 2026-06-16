import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenRefreshError } from "../calendar/token";
import { useBusyTimes } from "../hooks/useBusyTimes";
import { DEFAULT_CONFIG } from "../lib/config";
import { setRefreshToken } from "../lib/secrets";

vi.mock("../calendar/providers", () => ({
  fetchEventsForProvider: vi.fn(),
}));
import { fetchEventsForProvider } from "../calendar/providers";

const now = new Date("2026-01-01T03:00:00Z");

beforeEach(() => {
  vi.mocked(fetchEventsForProvider).mockReset();
});

describe("useBusyTimes (Pro: 3 provider)", () => {
  it("全 provider 未連携なら events は空でローディングしない", async () => {
    const { result } = renderHook(() =>
      useBusyTimes(
        { google: false, microsoft: false, apple: false },
        DEFAULT_CONFIG,
        now,
      ),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
  });

  it("connected=null (確認中) なら events は空", async () => {
    const { result } = renderHook(() =>
      useBusyTimes(
        { google: null, microsoft: null, apple: null },
        DEFAULT_CONFIG,
        now,
      ),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
  });

  it("invalid_grant (refresh_token 失効) で失敗したら onAuthExpired(provider) を呼ぶ", async () => {
    await setRefreshToken("google", "rt");
    vi.mocked(fetchEventsForProvider).mockRejectedValue(
      new TokenRefreshError("google", 400, '{"error":"invalid_grant"}'),
    );
    const onAuthExpired = vi.fn();

    const { result } = renderHook(() =>
      useBusyTimes(
        { google: true, microsoft: false, apple: false },
        DEFAULT_CONFIG,
        now,
        onAuthExpired,
      ),
    );

    await waitFor(() => expect(onAuthExpired).toHaveBeenCalledWith("google"));
    await waitFor(() => expect(result.current.errors.google).toBeTruthy());
  });

  it("invalid_grant 以外の失敗では onAuthExpired を呼ばず通常エラー表示", async () => {
    await setRefreshToken("google", "rt");
    vi.mocked(fetchEventsForProvider).mockRejectedValue(new Error("network down"));
    const onAuthExpired = vi.fn();

    const { result } = renderHook(() =>
      useBusyTimes(
        { google: true, microsoft: false, apple: false },
        DEFAULT_CONFIG,
        now,
        onAuthExpired,
      ),
    );

    await waitFor(() => expect(result.current.errors.google).toContain("network down"));
    expect(onAuthExpired).not.toHaveBeenCalled();
  });
});
