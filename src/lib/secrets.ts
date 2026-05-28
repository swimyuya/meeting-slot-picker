/**
 * 秘密情報・connectId・identity の保存と取得。
 *
 * 保存先:
 *   - Tauri: Rust 側 keyring コマンド (macOS Keychain) を invoke する。
 *   - Chrome 拡張機能: chrome.storage.local (storage-extension)。
 *   - Web (PWA / ブラウザ): IndexedDB (storage-web)。
 *
 * Provider-aware: Pro 版では Google / Microsoft の refresh_token を別キーで保持する。
 * 既存「日程ピッカー」(Google 専用) と同じ google_refresh_token キーを使うため、
 * 既存 Pro 内 Google 連携 user の Google token はそのまま読める (マイグレーション不要)。
 */

import type { ProviderId } from "../auth/providers";
import {
  deleteSecretExtension,
  getSecretExtension,
  setSecretExtension,
} from "./storage-extension";
import { deleteSecretWeb, getSecretWeb, setSecretWeb } from "./storage-web";
import { isExtension, isTauri } from "./tauri";

/** refresh_token を保存するキー (provider 別)。 */
export const REFRESH_TOKEN_KEYS: Readonly<Record<ProviderId, string>> = {
  google: "google_refresh_token",
  microsoft: "microsoft_refresh_token",
} as const;

/** 後方互換用 (旧 Google 専用版で使われていた定数)。 */
export const REFRESH_TOKEN_KEY = REFRESH_TOKEN_KEYS.google;

/** サブスク将来化用 identity キー。Pro Beta 中は表示にも使わず、storage に置くだけ。 */
const USER_EMAIL_KEY = "pro:user_email";
const PROVIDER_FOR_IDENTITY_KEY = "pro:provider_for_identity";
const FIRST_CONNECTED_AT_KEY = "pro:first_connected_at";

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

// ---- refresh_token (provider-aware) ----

export const getRefreshToken = (provider: ProviderId): Promise<string | null> =>
  getSecret(REFRESH_TOKEN_KEYS[provider]);
export const setRefreshToken = (provider: ProviderId, value: string): Promise<void> =>
  setSecret(REFRESH_TOKEN_KEYS[provider], value);
export const deleteRefreshToken = (provider: ProviderId): Promise<void> =>
  deleteSecret(REFRESH_TOKEN_KEYS[provider]);

// ---- 識別 (将来のサブスク用、enforcement なし) ----

export const setUserEmail = (email: string): Promise<void> => setSecret(USER_EMAIL_KEY, email);
export const getUserEmail = (): Promise<string | null> => getSecret(USER_EMAIL_KEY);

export const setProviderForIdentity = (provider: ProviderId): Promise<void> =>
  setSecret(PROVIDER_FOR_IDENTITY_KEY, provider);
export const getProviderForIdentity = (): Promise<string | null> =>
  getSecret(PROVIDER_FOR_IDENTITY_KEY);

/** 一番最初に連携した日時を保存 (上書きしない)。サブスク trial 起点に使う想定。 */
export async function setFirstConnectedAtIfMissing(iso: string): Promise<void> {
  const existing = await getSecret(FIRST_CONNECTED_AT_KEY);
  if (existing) return;
  await setSecret(FIRST_CONNECTED_AT_KEY, iso);
}
export const getFirstConnectedAt = (): Promise<string | null> =>
  getSecret(FIRST_CONNECTED_AT_KEY);
