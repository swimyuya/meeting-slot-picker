/**
 * 後方互換シム `useAuthStatus` (Google 専用 API) の検証。
 * 新規コードは `useProviderStatus` を使うことが推奨。
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/oauth-web", () => ({
  signInWeb: vi.fn().mockRejectedValue(new Error("test: signInWeb is mocked")),
}));

import { useAuthStatus } from "../hooks/useAuthStatus";
import { setRefreshToken } from "../lib/secrets";

describe("useAuthStatus (legacy shim)", () => {
  it("Google トークンがあれば connected=true", async () => {
    await setRefreshToken("google", "rt");
    const { result } = renderHook(() => useAuthStatus());
    await waitFor(() => expect(result.current.connected).toBe(true));
  });

  it("Google トークンが無ければ connected=false", async () => {
    const { result } = renderHook(() => useAuthStatus());
    await waitFor(() => expect(result.current.connected).toBe(false));
  });

  it("connect 失敗時はエラー状態をセットする", async () => {
    const { result } = renderHook(() => useAuthStatus());
    await waitFor(() => expect(result.current.connected).toBe(false));
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.error).toBeTruthy();
  });

  it("disconnect で connected=false に戻る", async () => {
    await setRefreshToken("google", "rt");
    const { result } = renderHook(() => useAuthStatus());
    await waitFor(() => expect(result.current.connected).toBe(true));
    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.connected).toBe(false);
  });
});
