import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStatus } from "../hooks/useAuthStatus";
import { setRefreshToken } from "../lib/secrets";

beforeEach(() => localStorage.clear());

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

  it("connect 失敗時はエラー状態をセットする (jsdom 環境では Tauri 不在/clientId 未設定で必ず失敗)", async () => {
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
