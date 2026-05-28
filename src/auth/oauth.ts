/**
 * Google OAuth (Desktop / loopback + PKCE) フロー。
 *
 * 1. PKCE (verifier / S256 challenge) を生成
 * 2. 認可 URL を組み立て、Rust 側 (oauth_capture_code) がループバックサーバ起動＋ブラウザを開く
 * 3. リダイレクトの ?code= を受け取り、token endpoint で refresh_token に交換
 * 4. refresh_token を Keychain に保存
 *
 * 認可 URL / token 交換は line-reply-drafter/scripts/google-auth.mjs を基にしている。
 */

import { httpFetch, safeErrorBody, type HttpFetch } from "../lib/http";
import { setRefreshToken } from "../lib/secrets";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const DEFAULT_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const DEFAULT_PORT = 4321;
const DEFAULT_TIMEOUT_SECS = 180;

export interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  scope?: string;
  port?: number;
}

export interface OAuthDeps {
  fetchFn?: HttpFetch;
  /** ループバックでリダイレクトを待ち受け code を返す (既定: Rust コマンド)。 */
  captureCode?: (port: number, authUrl: string, expectedState: string) => Promise<string>;
}

/** PKCE の code_verifier と S256 code_challenge を生成する。 */
export async function generatePkce(): Promise<{ verifier: string; challenge: string }> {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  const verifier = base64UrlEncode(random.buffer);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

/** 認可 URL を組み立てる。 */
export function buildAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  scope: string;
  challenge: string;
  state: string;
}): string {
  const q = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: params.scope,
    access_type: "offline",
    prompt: "consent",
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: "S256",
  });
  return `${AUTH_ENDPOINT}?${q.toString()}`;
}

/** authorization code を token endpoint で交換し refresh_token を得る。 */
export async function exchangeCode(
  input: {
    clientId: string;
    clientSecret?: string;
    code: string;
    codeVerifier: string;
    redirectUri: string;
  },
  deps: { fetchFn?: HttpFetch } = {},
): Promise<{ refreshToken: string; accessToken: string }> {
  const fetchFn = deps.fetchFn ?? httpFetch;
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });
  if (input.clientSecret) body.set("client_secret", input.clientSecret);

  const res = await fetchFn(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`oauth token exchange failed: ${res.status} ${await safeErrorBody(res)}`);
  }
  const json = (await res.json()) as { refresh_token?: string; access_token?: string };
  if (!json.refresh_token) {
    throw new Error(
      "refresh_token が返りませんでした。Google アカウント設定でアクセスを一度解除してから再試行してください。",
    );
  }
  return { refreshToken: json.refresh_token, accessToken: json.access_token ?? "" };
}

/** OAuth フロー全体を実行し、refresh_token を Keychain に保存する。 */
export async function connectGoogle(config: OAuthConfig, deps: OAuthDeps = {}): Promise<void> {
  if (!config.clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID が未設定です (.env.local を確認してください)。");
  }
  const port = config.port ?? DEFAULT_PORT;
  const scope = config.scope ?? DEFAULT_SCOPE;
  // RFC 8252 準拠で 127.0.0.1 を使う (localhost だと IPv6 解決で取りこぼす恐れ)。
  const redirectUri = `http://127.0.0.1:${port}`;

  const { verifier, challenge } = await generatePkce();
  const state = generateState();
  const authUrl = buildAuthUrl({ clientId: config.clientId, redirectUri, scope, challenge, state });

  const capture = deps.captureCode ?? defaultCaptureCode;
  const code = await capture(port, authUrl, state);

  const { refreshToken } = await exchangeCode(
    {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      codeVerifier: verifier,
      redirectUri,
    },
    { fetchFn: deps.fetchFn },
  );
  await setRefreshToken(refreshToken);
}

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

/** CSRF 対策の state (ランダム 16 バイト)。 */
function generateState(): string {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  return base64UrlEncode(random.buffer);
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
