/**
 * useProviderStatus: provider 別に連携状態を保持し、connect/disconnect を行う。
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/oauth-web", () => ({
  signInWeb: vi.fn().mockRejectedValue(new Error("test: signInWeb mocked")),
}));

import { useProviderStatus } from "../hooks/useProviderStatus";
import { setRefreshToken } from "../lib/secrets";

describe("useProviderStatus", () => {
  it("初期: 両 provider とも未連携と判定される", async () => {
    const { result } = renderHook(() => useProviderStatus());
    await waitFor(() => expect(result.current.allKnown).toBe(true));
    expect(result.current.connected.google).toBe(false);
    expect(result.current.connected.microsoft).toBe(false);
    expect(result.current.hasAny).toBe(false);
  });

  it("Google の refresh_token があれば google=true", async () => {
    await setRefreshToken("google", "rt");
    const { result } = renderHook(() => useProviderStatus());
    await waitFor(() => expect(result.current.connected.google).toBe(true));
    expect(result.current.connected.microsoft).toBe(false);
    expect(result.current.hasAny).toBe(true);
  });

  it("Microsoft も繋がっていれば両方 true", async () => {
    await setRefreshToken("google", "rt");
    await setRefreshToken("microsoft", "ms-rt");
    const { result } = renderHook(() => useProviderStatus());
    await waitFor(() => expect(result.current.connected.microsoft).toBe(true));
    expect(result.current.connected.google).toBe(true);
    expect(result.current.hasAny).toBe(true);
  });

  it("disconnect でその provider だけ解除", async () => {
    await setRefreshToken("google", "rt");
    await setRefreshToken("microsoft", "ms-rt");
    const { result } = renderHook(() => useProviderStatus());
    await waitFor(() => expect(result.current.connected.microsoft).toBe(true));

    await act(async () => {
      await result.current.disconnect("microsoft");
    });
    await waitFor(() => expect(result.current.connected.microsoft).toBe(false));
    expect(result.current.connected.google).toBe(true);
  });

  it("connect 失敗時はその provider 別エラーをセットする", async () => {
    const { result } = renderHook(() => useProviderStatus());
    await waitFor(() => expect(result.current.allKnown).toBe(true));
    await act(async () => {
      await result.current.connect("google");
    });
    expect(result.current.error.google).toBeTruthy();
    expect(result.current.error.microsoft).toBeUndefined();
  });
});
