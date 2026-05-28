/**
 * Web (PWA) 用 OAuth フロー — provider 共通の redirect 方式 + PKCE。
 *
 * フロー:
 *   1. PKCE verifier/challenge と state を生成 (provider 仕様で extraAuthParams を反映)
 *   2. verifier/state/redirect_uri/provider を sessionStorage に保存
 *   3. window.location.href = <provider 認可 URL> (この関数は return しない)
 *   4. Google/Microsoft → /auth/callback?code=...&state=...
 *   5. CallbackPage が handleAuthCallback() を呼ぶ:
 *      - sessionStorage から provider を復元 → state を verify
 *      - /api/auth/exchange に code + verifier + provider を POST
 *      - refresh_token を IndexedDB に保存 + id_token から email 抽出して identity 保存
 *
 * Desktop 版 (oauth.ts) と異なり、token endpoint は経由せず Vercel Function を介す。
 * Web Application client では client_secret 必須のため。
 */

import { getApiBaseUrl } from "../lib/env";
import {
  setFirstConnectedAtIfMissing,
  setProviderForIdentity,
  setRefreshToken,
  setUserEmail,
} from "../lib/secrets";
import { emailFromIdToken } from "./identity";
import { buildAuthUrl, generatePkce, generateState } from "./oauth";
import { getProviderSpec, type ProviderId } from "./providers";

const VERIFIER_KEY = "msp:oauth:verifier";
const STATE_KEY = "msp:oauth:state";
const REDIRECT_KEY = "msp:oauth:redirect_uri";
const PROVIDER_KEY = "msp:oauth:provider";

export interface WebSignInConfig {
  clientId: string;
  redirectUri: string;
  scope?: string;
}

/**
 * Google / Microsoft の同意画面へリダイレクトする。
 * この関数は通常 return しない (location.href で遷移)。
 */
export async function signInWeb(
  provider: ProviderId,
  config: WebSignInConfig,
): Promise<never> {
  if (!config.clientId) {
    throw new Error(
      `${getProviderSpec(provider).displayName}: client_id が未設定です。`,
    );
  }
  if (!config.redirectUri) {
    throw new Error("redirect_uri が空です。");
  }
  const spec = getProviderSpec(provider);
  const { verifier, challenge } = await generatePkce();
  const state = generateState();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(REDIRECT_KEY, config.redirectUri);
  sessionStorage.setItem(PROVIDER_KEY, provider);

  const authUrl = buildAuthUrl(spec, {
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    scope: config.scope ?? spec.defaultScope,
    challenge,
    state,
  });
  window.location.href = authUrl;
  // 遷移を待つ間に Promise を解決させないため、無限に pending する
  return new Promise<never>(() => {});
}

/** /auth/callback で実行。URL から code/state を取って token に交換し、refresh_token を保存する。 */
export async function handleAuthCallback(
  deps: { fetchFn?: typeof fetch } = {},
): Promise<void> {
  const fetchFn = deps.fetchFn ?? fetch;
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const errorParam = params.get("error");

  if (errorParam) {
    throw new Error(`認可エラー: ${errorParam}`);
  }
  if (!code || !state) {
    throw new Error("認可コードまたは state がレスポンスに含まれません。");
  }

  const expectedState = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const redirectUri = sessionStorage.getItem(REDIRECT_KEY);
  const providerRaw = sessionStorage.getItem(PROVIDER_KEY);

  if (!expectedState || !verifier || !redirectUri) {
    throw new Error("セッションが見つかりません。もう一度連携をやり直してください。");
  }
  // provider はホワイトリスト一致でのみ受け付ける (sessionStorage が壊れていた場合は
  // "google" に決め打ちせず明示的にエラーにする)。
  if (providerRaw !== "google" && providerRaw !== "microsoft") {
    throw new Error("セッションが破損しています。もう一度連携をやり直してください。");
  }
  const provider: ProviderId = providerRaw;
  if (state !== expectedState) {
    throw new Error("state が一致しません (CSRF の可能性があります)。");
  }

  const apiUrl = `${getApiBaseUrl()}/api/auth/exchange`;
  const res = await fetchFn(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      code,
      code_verifier: verifier,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const body = await safeJson(res);
    throw new Error(`/api/auth/exchange 失敗: ${res.status} ${body.message ?? body.error ?? ""}`);
  }
  const json = (await res.json()) as { refresh_token?: string; id_token?: string };
  if (!json.refresh_token) {
    throw new Error("refresh_token がレスポンスに含まれません。");
  }
  await setRefreshToken(provider, json.refresh_token);

  // identity (email) を保存 — 失敗は無視
  try {
    const email = emailFromIdToken(json.id_token);
    if (email) {
      await setUserEmail(email);
      await setProviderForIdentity(provider);
      await setFirstConnectedAtIfMissing(new Date().toISOString());
    }
  } catch {
    /* ignore */
  }

  clearOAuthSession();
}

/** sessionStorage に残った OAuth 中間データをクリアする。 */
export function clearOAuthSession(): void {
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  sessionStorage.removeItem(PROVIDER_KEY);
}

async function safeJson(res: Response): Promise<{ error?: string; message?: string }> {
  return (await res.json().catch(() => ({}))) as { error?: string; message?: string };
}
