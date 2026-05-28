/**
 * 秘密情報の保存・取得。
 * - Tauri: Rust 側 keyring コマンド (macOS Keychain) を invoke する。
 * - Chrome 拡張機能: chrome.storage.local (storage-extension)。
 * - Web (PWA / ブラウザ): IndexedDB (storage-web)。
 */

import {
  deleteSecretExtension,
  getSecretExtension,
  setSecretExtension,
} from "./storage-extension";
import { deleteSecretWeb, getSecretWeb, setSecretWeb } from "./storage-web";
import { isExtension, isTauri } from "./tauri";

export const REFRESH_TOKEN_KEY = "google_refresh_token";

export async function getSecret(key: string): Promise<string | null> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string | null>("secret_get", { key });
  }
  if (isExtension()) return getSecretExtension(key);
  return getSecretWeb(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("secret_set", { key, value });
    return;
  }
  if (isExtension()) return setSecretExtension(key, value);
  return setSecretWeb(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("secret_delete", { key });
    return;
  }
  if (isExtension()) return deleteSecretExtension(key);
  return deleteSecretWeb(key);
}

export const getRefreshToken = (): Promise<string | null> => getSecret(REFRESH_TOKEN_KEY);
export const setRefreshToken = (value: string): Promise<void> => setSecret(REFRESH_TOKEN_KEY, value);
export const deleteRefreshToken = (): Promise<void> => deleteSecret(REFRESH_TOKEN_KEY);
