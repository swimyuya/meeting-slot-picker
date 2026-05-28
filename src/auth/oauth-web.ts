/**
 * Google OAuth — Web (PWA) フロー。
 *
 * 1. PKCE verifier/challenge と state を生成
 * 2. verifier/state を sessionStorage に保存
 * 3. window.location.href = Google 認可 URL  (← この関数はここで return しない)
 * 4. Google → /auth/callback?code=...&state=...
 * 5. CallbackPage が handleAuthCallback() を呼ぶ:
 *    - state を verify
 *    - /api/auth/exchange に code + verifier を POST → tokens を受領
 *    - refresh_token を IndexedDB に保存
 *
 * Desktop 版 (oauth.ts) と異なり、token endpoint は経由せず Vercel Function を介す。
 * これは Web Application client では client_secret 必須のため。
 */

import { getApiBaseUrl } from "../lib/env";
import { setRefreshToken } from "../lib/secrets";
import { buildAuthUrl, DEFAULT_SCOPE, generatePkce } from "./oauth";

const VERIFIER_KEY = "msp:oauth:verifier";
const STATE_KEY = "msp:oauth:state";
const REDIRECT_KEY = "msp:oauth:redirect_uri";

export interface WebSignInConfig {
  clientId: string;
  redirectUri: string;
  scope?: string;
}

/**
 * Google 同意画面へリダイレクトする。
 * この関数は通常 return しない (location.href で遷移)。
 */
export async function signInWeb(config: WebSignInConfig): Promise<never> {
  if (!config.clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID が未設定です。");
  }
  if (!config.redirectUri) {
    throw new Error("redirect_uri が空です。");
  }
  const { verifier, challenge } = await generatePkce();
  const state = generateState();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(REDIRECT_KEY, config.redirectUri);

  const authUrl = buildAuthUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scope: config.scope ?? DEFAULT_SCOPE,
    challenge,
    state,
  });
  window.location.href = authUrl;
  // 遷移を待つ間に Promise を解決させないため、無限に pending する
  return new Promise<never>(() => {});
}

/** /auth/callback で実行。URL から code/state を取って token に交換し、refresh_token を保存する。 */
export async function handleAuthCallback(deps: {
  fetchFn?: typeof fetch;
} = {}): Promise<void> {
  const fetchFn = deps.fetchFn ?? fetch;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const errorParam = params.get("error");

  if (errorParam) {
    throw new Error(`Google 認可エラー: ${errorParam}`);
  }
  if (!code || !state) {
    throw new Error("認可コードまたは state がレスポンスに含まれません。");
  }

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const redirectUri = sessionStorage.getItem(REDIRECT_KEY);
  if (!expectedState || !verifier || !redirectUri) {
    throw new Error("セッションが見つかりません。もう一度連携をやり直してください。");
  }
  if (state !== expectedState) {
    throw new Error("state が一致しません (CSRF の可能性があります)。");
  }

  const apiUrl = `${getApiBaseUrl()}/api/auth/exchange`;
  const res = await fetchFn(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`/api/auth/exchange 失敗: ${res.status} ${body.message ?? body.error ?? ""}`);
  }
  const json = (await res.json()) as { refresh_token?: string };
  if (!json.refresh_token) {
    throw new Error("refresh_token がレスポンスに含まれません。");
  }
  await setRefreshToken(json.refresh_token);
  clearOAuthSession();
}

/** sessionStorage に残った OAuth 中間データをクリアする。 */
export function clearOAuthSession(): void {
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
}

async function safeJson(res: Response): Promise<{ error?: string; message?: string }> {
  return (await res.json().catch(() => ({}))) as { error?: string; message?: string };
}

function generateState(): string {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  let binary = "";
  for (const b of random) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
