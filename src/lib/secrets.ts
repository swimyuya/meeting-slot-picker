/**
 * 秘密情報の保存・取得。
 * - Tauri: Rust 側 keyring コマンド (macOS Keychain) を invoke する。
 * - それ以外 (テスト・ブラウザ): localStorage フォールバック (開発用)。
 */

import { isTauri } from "./tauri";

export const REFRESH_TOKEN_KEY = "google_refresh_token";
const LS_PREFIX = "meeting-slot-picker:secret:";

export async function getSecret(key: string): Promise<string | null> {
  if (!isTauri()) {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(LS_PREFIX + key);
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string | null>("secret_get", { key });
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (!isTauri()) {
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_PREFIX + key, value);
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("secret_set", { key, value });
}

export async function deleteSecret(key: string): Promise<void> {
  if (!isTauri()) {
    if (typeof localStorage !== "undefined") localStorage.removeItem(LS_PREFIX + key);
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("secret_delete", { key });
}

export const getRefreshToken = (): Promise<string | null> => getSecret(REFRESH_TOKEN_KEY);
export const setRefreshToken = (value: string): Promise<void> => setSecret(REFRESH_TOKEN_KEY, value);
export const deleteRefreshToken = (): Promise<void> => deleteSecret(REFRESH_TOKEN_KEY);
