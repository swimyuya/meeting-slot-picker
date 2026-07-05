/**
 * OAuth プリミティブ (PKCE / 認可 URL / token 交換) と、
 * desktop / Web / Chrome 拡張の 3 フローが共有するヘルパ。
 *
 * ランタイム固有の code 捕捉だけが各フローの責務:
 *   - desktop (oauth.ts):        Rust loopback (oauth_capture_code)
 *   - Web (oauth-web.ts):        フルページ redirect + /auth/callback
 *   - 拡張 (oauth-extension.ts): chrome.identity.launchWebAuthFlow
 */

import { getApiBaseUrl } from "../lib/env";
import { httpFetch, safeErrorBody, type HttpFetch } from "../lib/http";
import {
  setFirstConnectedAtIfMissing,
  setProviderForIdentity,
  setUserEmail,
} from "../lib/secrets";
import { emailFromIdToken } from "./identity";
import {
  getProviderSpec,
  type OAuthProviderId,
  type ProviderOAuthSpec,
} from "./providers";

/**
 * PKCE の code_verifier と S256 code_challenge を生成する。
 * RFC 7636 は 32–96 bytes を許容、推奨は 48 bytes 程度。
 * 余裕を持たせて 48 bytes (base64url で 64 文字、384 bits エントロピー) にする。
 */
export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(48);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random.buffer);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

/**
 * 認可 URL を組み立てる。provider 仕様 (extraAuthParams) を反映するので
 * Google の access_type=offline / Microsoft の prompt=select_account も入る。
 */
export function buildAuthUrl(
  spec: ProviderOAuthSpec,
  params: {
    clientId: string;
    redirectUri: string;
    scope: string;
    challenge: string;
    state: string;
  },
): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scope,
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
  });
  // provider 固有の追加クエリ (access_type=offline / prompt=consent 等)
  for (const [k, v] of Object.entries(spec.extraAuthParams ?? {})) {
    q.set(k, v);
  }
  return `${spec.authEndpoint}?${q.toString()}`;
}

/** CSRF 対策の state。256 bits (32 bytes) のランダム値で衝突・推測耐性を確保。 */
export function generateState(): string {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  return base64UrlEncode(random.buffer);
}

export function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PKCE + state + 認可 URL の組み立て (3 フロー共通の前準備)。 */
export interface AuthRequest {
  verifier: string;
  state: string;
  authUrl: string;
}

export async function prepareAuthRequest(
  spec: ProviderOAuthSpec,
  params: { clientId: string; redirectUri: string; scope?: string },
): Promise<AuthRequest> {
  const { verifier, challenge } = await generatePkce();
  const state = generateState();
  const authUrl = buildAuthUrl(spec, {
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scope: params.scope ?? spec.defaultScope,
    challenge,
    state,
  });
  return { verifier, state, authUrl };
}

/**
 * clientId 未設定ガード (3 フロー共通)。
 * envHint は desktop だけが " (.env.local を確認してください)" を渡す。
 */
export function requireClientId(
  provider: OAuthProviderId,
  clientId: string,
  envHint = "",
): void {
  if (!clientId) {
    throw new Error(
      `${getProviderSpec(provider).displayName}: client_id が未設定です${envHint}。`,
    );
  }
}

/** authorization code を token endpoint で交換し refresh_token を得る (desktop 直接経路)。 */
export async function exchangeCode(
  spec: ProviderOAuthSpec,
  input: {
    clientId: string;
    clientSecret?: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  },
  deps: { fetchFn?: HttpFetch } = {},
): Promise<{ refreshToken: string; accessToken: string; idToken: string | undefined }> {
  const fetchFn = deps.fetchFn ?? httpFetch;
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  if (input.clientSecret) body.set("client_secret", input.clientSecret);

  const res = await fetchFn(spec.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`oauth token exchange failed: ${res.status} ${await safeErrorBody(res)}`);
  }
  const json = (await res.json()) as {
    refresh_token?: string;
    access_token?: string;
    id_token?: string;
  };
  if (!json.refresh_token) {
    throw new Error(spec.noRefreshTokenMessage);
  }
  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token ?? "",
    idToken: json.id_token,
  };
}

/**
 * authorization code を Vercel Function (/api/auth/exchange) 経由で交換する
 * (Web / 拡張の server 経路。client_secret はサーバ側でのみ使う)。
 */
export async function exchangeViaServer(
  provider: OAuthProviderId,
  args: { code: string; codeVerifier: string; redirectUri: string },
  deps: { fetchFn?: typeof fetch } = {},
): Promise<{ refreshToken: string; idToken?: string }> {
  const fetchFn = deps.fetchFn ?? fetch;
  const apiUrl = `${getApiBaseUrl()}/api/auth/exchange`;
  const res = await fetchFn(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      code: args.code,
      code_verifier: args.codeVerifier,
      redirect_uri: args.redirectUri,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(
      `/api/auth/exchange 失敗: ${res.status} ${body.message ?? body.error ?? ""}`,
    );
  }
  const json = (await res.json()) as { refresh_token?: string; id_token?: string };
  if (!json.refresh_token) {
    throw new Error("refresh_token がレスポンスに含まれません。");
  }
  return { refreshToken: json.refresh_token, idToken: json.id_token };
}

/**
 * id_token から email を取り出して保存。サブスク化したときに user 識別子として使う。
 * 失敗しても OAuth 自体は成功扱いにする (cosmetic な情報なので)。
 */
export async function persistIdentityIfPossible(
  provider: OAuthProviderId,
  idToken: string | undefined,
): Promise<void> {
  try {
    const email = emailFromIdToken(idToken);
    if (!email) return;
    await setUserEmail(email);
    await setProviderForIdentity(provider);
    await setFirstConnectedAtIfMissing(new Date().toISOString());
  } catch {
    // 失敗は無視。connect 自体は成功させる
  }
}
