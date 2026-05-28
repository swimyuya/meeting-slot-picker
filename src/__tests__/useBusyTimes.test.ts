import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBusyTimes } from "../hooks/useBusyTimes";
import { DEFAULT_CONFIG } from "../lib/config";

const now = new Date("2026-01-01T03:00:00Z");

describe("useBusyTimes", () => {
  it("未連携なら events は空でローディングしない", async () => {
    const { result } = renderHook(() => useBusyTimes(false, DEFAULT_CONFIG, now));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
  });

  it("clientId 未設定なら連携済みでも events は空", async () => {
    const { result } = renderHook(() => useBusyTimes(true, DEFAULT_CONFIG, now));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([]);
  });
});
