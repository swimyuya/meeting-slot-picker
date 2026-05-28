/**
 * Provider 別の access_token 取得。
 * 5 分マージン付きのモジュールキャッシュを refresh_token ごとに保持する。
 *
 * 経路:
 *   - Tauri: provider の tokenEndpoint に直接 POST (Google: oauth2.googleapis.com,
 *     Microsoft: login.microsoftonline.com)
 *   - Web (PWA) / Chrome 拡張: Vercel Function `/api/auth/refresh` に body
 *     `{ provider, refresh_token }` で POST
 *
 * Microsoft の rotating refresh_token 対応: refresh レスポンスに `refresh_token`
 * が含まれていたら secrets に上書き保存する。
 */

import {
  getOAuthProviderSpec,
  type OAuthProviderId,
} from "../auth/providers";
import { getApiBaseUrl } from "../lib/env";
import { httpFetch, safeErrorBody, type HttpFetch } from "../lib/http";
import { setRefreshToken } from "../lib/secrets";
import { isTauri } from "../lib/tauri";

const WEB_REFRESH_ENDPOINT = "/api/auth/refresh";
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;
const DEFAULT_EXPIRES_IN_S = 3600;

export interface TokenInput {
  clientId: string;
  clientSecret?: string;
  refreshToken: string;
}

export interface TokenDeps {
  fetchFn?: HttpFetch;
  now?: () => number;
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

const cache = new Map<string, CachedToken>();
const inflight = new Map<string, Promise<string>>();

/** テスト用: トークンキャッシュをクリアする。 */
export function clearTokenCache(): void {
  cache.clear();
  inflight.clear();
}

function cacheKey(provider: OAuthProviderId, refreshToken: string): string {
  return `${provider}:${refreshToken}`;
}

export async function getAccessToken(
  provider: OAuthProviderId,
  input: TokenInput,
  deps: TokenDeps = {},
): Promise<string> {
  const now = deps.now ?? Date.now;
  const ck = cacheKey(provider, input.refreshToken);

  const cached = cache.get(ck);
  if (cached && cached.expiresAtMs - EXPIRY_MARGIN_MS > now()) {
    return cached.token;
  }

  // 同時呼び出しは 1 回のリクエストに集約する (重複 refresh による invalid_grant を防ぐ)。
  const pending = inflight.get(ck);
  if (pending) return pending;

  const promise = requestToken(provider, input, deps).finally(() => {
    inflight.delete(ck);
  });
  inflight.set(ck, promise);
  return promise;
}

async function requestToken(
  provider: OAuthProviderId,
  input: TokenInput,
  deps: TokenDeps,
): Promise<string> {
  const fetchFn = deps.fetchFn ?? httpFetch;
  const now = deps.now ?? Date.now;
  const ck = cacheKey(provider, input.refreshToken);

  if (!isTauri()) {
    // Web (PWA) / Chrome 拡張: Vercel Function 経由 (client_secret サーバ側)
    const res = await fetchFn(`${getApiBaseUrl()}${WEB_REFRESH_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, refresh_token: input.refreshToken }),
    });
    if (!res.ok) {
      throw new Error(`refresh failed: ${res.status} ${await safeErrorBody(res)}`);
    }
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };
    if (!json.access_token) throw new Error("refresh: no access_token");

    // Microsoft の rotating refresh_token: response にあれば保存しなおす
    if (json.refresh_token && json.refresh_token !== input.refreshToken) {
      await setRefreshToken(provider, json.refresh_token);
    }

    const expiresInMs = (json.expires_in ?? DEFAULT_EXPIRES_IN_S) * 1000;
    cache.set(ck, { token: json.access_token, expiresAtMs: now() + expiresInMs });
    return json.access_token;
  }

  // Tauri: provider の token endpoint に直接 POST (Desktop client は client_secret 同梱)
  const spec = getOAuthProviderSpec(provider);
  const body = new URLSearchParams({
    client_id: input.clientId,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  });
  if (input.clientSecret) body.set("client_secret", input.clientSecret);

  const res = await fetchFn(spec.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`refresh failed: ${res.status} ${await safeErrorBody(res)}`);
  }
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
  };
  if (!json.access_token) throw new Error("refresh: no access_token");

  if (json.refresh_token && json.refresh_token !== input.refreshToken) {
    await setRefreshToken(provider, json.refresh_token);
  }

  const expiresInMs = (json.expires_in ?? DEFAULT_EXPIRES_IN_S) * 1000;
  cache.set(ck, { token: json.access_token, expiresAtMs: now() + expiresInMs });
  return json.access_token;
}
