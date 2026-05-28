/**
 * 後方互換シム: 旧 Google 専用 API。Pro 版では `useProviderStatus` を使うこと。
 * 既存テスト互換のため残す。
 */

import { useProviderStatus } from "./useProviderStatus";

export function useAuthStatus() {
  const status = useProviderStatus();
  return {
    connected: status.connected.google,
    busy: status.busy === "google",
    error: status.error.google ?? null,
    connect: () => status.connect("google"),
    disconnect: () => status.disconnect("google"),
  };
}
