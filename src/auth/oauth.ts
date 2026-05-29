/**
 * Tauri (デスクトップ) 用 OAuth フロー — loopback + PKCE。
 *
 * Pro 版では provider (Google / Microsoft) を引数で受け取り、各々の
 * 認可エンドポイント / tokenエンドポイント / scope に応じて動作する。
 *
 * フロー:
 *   1. PKCE (verifier / S256 challenge) を生成
 *   2. 認可 URL を組み立て、Rust 側 (oauth_capture_code) が loopback サーバ起動＋ブラウザを開く
 *   3. リダイレクトの ?code= を受け取り、token endpoint で refresh_token に交換
 *   4. refresh_token を Keychain に provider 別キーで保存
 *   5. id_token から email を取り出して identity ストアに保存 (将来のサブスク用)
 *
 * Web (PWA) / Chrome 拡張ランタイムでは、各々のフローへ自動 dispatch する。
 */

import { getWebRedirectUri } from "../lib/env";
import { httpFetch, safeErrorBody, type HttpFetch } from "../lib/http";
import {
  setFirstConnectedAtIfMissing,
  setProviderForIdentity,
  setRefreshToken,
  setUserEmail,
} from "../lib/secrets";
import { isExtension, isTauri } from "../lib/tauri";
import { emailFromIdToken } from "./identity";
import {
  getOAuthProviderSpec,
  getProviderSpec,
  type OAuthProviderId,
  type ProviderOAuthSpec,
} from "./providers";

const DEFAULT_TIMEOUT_SECS = 180;

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  scope?: string;
  port?: number;
}

export interface OAuthDeps {
  fetchFn?: HttpFetch;
  /** loopback でリダイレクトを待ち受け code を返す (既定: Rust コマンド)。 */
  captureCode?: (port: number, authUrl: string, expectedState: string) => Promise<string>;
}

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

/** Google legacy 用 buildAuthUrl 互換ラッパー (Google エンドポイント決め打ち)。 */
export function buildAuthUrlLegacyGoogle(params: {
  clientId: string;
  redirectUri: string;
  scope: string;
  challenge: string;
  state: string;
}): string {
  return buildAuthUrl(getOAuthProviderSpec("google"), params);
}

/** authorization code を token endpoint で交換し refresh_token を得る。 */
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
 * OAuth フロー全体を実行する (provider 引数化版)。
 *
 * 実行環境による dispatch:
 *   - Chrome 拡張機能 → signInExtension(provider, ...)
 *   - Web (PWA)      → signInWeb(provider, ...) (リダイレクトして return しない)
 *   - Tauri          → loopback で完結 (本関数内)
 */
export async function connect(
  provider: OAuthProviderId,
  config: OAuthConfig,
  deps: OAuthDeps = {},
): Promise<void> {
  if (!config.clientId) {
    throw new Error(
      `${getProviderSpec(provider).displayName}: client_id が未設定です (.env.local を確認してください)。`,
    );
  }
  const spec = getOAuthProviderSpec(provider);

  // テスト時は deps.captureCode が指定されるので、その場合は Tauri 経路に流す。
  if (!deps.captureCode) {
    if (isExtension()) {
      // popup から OAuth を始めると launchWebAuthFlow 中に popup が閉じて promise が
      // 死ぬため、Service Worker (background) にメッセージを送って実行を委譲する。
      // background は popup が閉じても動き続けるのでフローが完結する。
      const response = await sendOAuthToBackground(provider, {
        clientId: config.clientId,
        scope: config.scope,
      });
      if (!response.ok) {
        throw new Error(response.error ?? "OAuth via background failed");
      }
      return;
    }
    if (!isTauri()) {
      const { signInWeb } = await import("./oauth-web");
      await signInWeb(provider, {
        clientId: config.clientId,
        redirectUri: getWebRedirectUri(),
        scope: config.scope,
      });
      return;
    }
  }

  // Tauri loopback フロー
  const port = config.port ?? spec.defaultPort;
  const scope = config.scope ?? spec.defaultScope;
  // RFC 8252 準拠で 127.0.0.1 を使う (localhost だと IPv6 解決で取りこぼす恐れ)。
  const redirectUri = `http://127.0.0.1:${port}`;

  const { verifier, challenge } = await generatePkce();
  const state = generateState();
  const authUrl = buildAuthUrl(spec, {
    clientId: config.clientId,
    redirectUri,
    scope,
    challenge,
    state,
  });

  const capture = deps.captureCode ?? defaultCaptureCode;
  const code = await capture(port, authUrl, state);

  const { refreshToken, idToken } = await exchangeCode(
    spec,
    {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      codeVerifier: verifier,
      redirectUri,
    },
    { fetchFn: deps.fetchFn },
  );
  await setRefreshToken(provider, refreshToken);
  // サブスク将来化用に identity (email) を保存。失敗してもサインインは継続。
  await persistIdentityIfPossible(provider, idToken);
}

/** 後方互換: Pro 版以前の API。連携する provider は Google 固定。 */
export const connectGoogle = (config: OAuthConfig, deps: OAuthDeps = {}): Promise<void> =>
  connect("google", config, deps);

async function defaultCaptureCode(
  port: number,
  authUrl: string,
  expectedState: string,
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("oauth_capture_code", {
    port,
    authUrl,
    expectedState,
    timeoutSecs: DEFAULT_TIMEOUT_SECS,
  });
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

/**
 * Chrome 拡張機能: background service worker に OAuth フローを依頼する。
 * popup が閉じても SW が完結させる。失敗時は { ok: false, error }。
 *
 * timeout: launchWebAuthFlow + token exchange + storage で最大 ~3 分を想定し、
 * sendMessage 自体のレスポンスはこの間 pending する。
 */
async function sendOAuthToBackground(
  provider: OAuthProviderId,
  config: { clientId: string; scope?: string },
): Promise<{ ok: boolean; error?: string }> {
  // @types/chrome の宣言に頼って globalThis.chrome を扱う。
  const c = (globalThis as { chrome?: typeof chrome }).chrome;
  if (!c?.runtime?.sendMessage) {
    throw new Error("chrome.runtime.sendMessage is not available");
  }
  const runtime = c.runtime; // narrow for TS
  return new Promise((resolve) => {
    runtime.sendMessage(
      { type: "oauth_start", provider, config },
      (response: { ok: boolean; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          resolve({
            ok: false,
            error: chrome.runtime.lastError.message ?? "runtime error",
          });
          return;
        }
        if (!response) {
          resolve({ ok: false, error: "no response from background" });
          return;
        }
        resolve(response);
      },
    );
  });
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

// 旧コードが import する DEFAULT_SCOPE は Google 用と意味づけて re-export しておく
// (後方互換: 削除前提)。
export const DEFAULT_SCOPE = getOAuthProviderSpec("google").defaultScope;
