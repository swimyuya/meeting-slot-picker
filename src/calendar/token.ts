/**
 * Google OAuth: refresh_token から access_token を取得する。
 * 5分マージン付きのモジュールキャッシュを持つ (refresh_token ごと)。
 *
 * line-reply-drafter/backend/src/services/calendar.ts の getAccessToken を移植・拡張。
 */

import { getApiBaseUrl } from "../lib/env";
import { httpFetch, safeErrorBody, type HttpFetch } from "../lib/http";
import { isTauri } from "../lib/tauri";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
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

export async function getAccessToken(input: TokenInput, deps: TokenDeps = {}): Promise<string> {
  const now = deps.now ?? Date.now;

  const cached = cache.get(input.refreshToken);
  if (cached && cached.expiresAtMs - EXPIRY_MARGIN_MS > now()) {
    return cached.token;
  }

  // 同時呼び出しは1回のリクエストに集約する (重複 refresh による invalid_grant を防ぐ)。
  const pending = inflight.get(input.refreshToken);
  if (pending) return pending;

  const promise = requestToken(input, deps).finally(() => {
    inflight.delete(input.refreshToken);
  });
  inflight.set(input.refreshToken, promise);
  return promise;
}

async function requestToken(input: TokenInput, deps: TokenDeps): Promise<string> {
  const fetchFn = deps.fetchFn ?? httpFetch;
  const now = deps.now ?? Date.now;

  // Web (PWA): /api/auth/refresh に refresh_token のみを投げる。
  // client_secret は Vercel サーバ env で保持しているのでブラウザに置かない。
  if (!isTauri()) {
    const res = await fetchFn(`${getApiBaseUrl()}${WEB_REFRESH_ENDPOINT}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: input.refreshToken }),
    });
    if (!res.ok) {
      throw new Error(`refresh failed: ${res.status} ${await safeErrorBody(res)}`);
    }
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new Error("refresh: no access_token");
    const expiresInMs = (json.expires_in ?? DEFAULT_EXPIRES_IN_S) * 1000;
    cache.set(input.refreshToken, {
      token: json.access_token,
      expiresAtMs: now() + expiresInMs,
    });
    return json.access_token;
  }

  // Tauri (macOS): Google token endpoint に直接 POST (Desktop クライアントで client_secret を同梱)。
  const body = new URLSearchParams({
    client_id: input.clientId,
    refresh_token: input.refreshToken,
    grant_type: "refresh_token",
  });
  if (input.clientSecret) body.set("client_secret", input.clientSecret);

  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`google token failed: ${res.status} ${await safeErrorBody(res)}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error("google token: no access_token");

  const expiresInMs = (json.expires_in ?? DEFAULT_EXPIRES_IN_S) * 1000;
  cache.set(input.refreshToken, {
    token: json.access_token,
    expiresAtMs: now() + expiresInMs,
  });
  return json.access_token;
}
