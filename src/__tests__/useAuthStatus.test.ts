import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Web フローでは signInWeb が window.location 遷移するため jsdom では先に進めない。
// テスト用に reject する mock に差し替えて、useAuthStatus が catch でエラーを surface する
// 振る舞いを検証する。
vi.mock("../auth/oauth-web", () => ({
  signInWeb: vi.fn().mockRejectedValue(new Error("test: signInWeb is mocked")),
}));

import { useAuthStatus } from "../hooks/useAuthStatus";
import { setRefreshToken } from "../lib/secrets";

describe("useAuthStatus", () => {
  it("トークンがあれば connected=true", async () => {
    await setRefreshToken("rt");
    const { result } = renderHook(() => useAuthStatus());
    await waitFor(() => expect(result.current.connected).toBe(true));
  });

  it("トークンが無ければ connected=false", async () => {
    const { result } = renderHook(() => useAuthStatus());
    await waitFor(() => expect(result.current.connected).toBe(false));
  });

  it("connect 失敗時はエラー状態をセットする (oauth-web mock が reject)", async () => {
    const { result } = renderHook(() => useAuthStatus());
    await waitFor(() => expect(result.current.connected).toBe(false));
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.error).toBeTruthy();
  });

  it("disconnect で connected=false に戻る", async () => {
    await setRefreshToken("rt");
    const { result } = renderHook(() => useAuthStatus());
    await waitFor(() => expect(result.current.connected).toBe(true));
    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.connected).toBe(false);
  });
});
