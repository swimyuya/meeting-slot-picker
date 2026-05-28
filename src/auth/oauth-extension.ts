/**
 * Google OAuth — Chrome 拡張機能 (Manifest V3) フロー。
 *
 * 1. PKCE verifier/challenge と state を生成
 * 2. redirect_uri = chrome.identity.getRedirectURL()
 *    → 形式: https://<extension-id>.chromiumapp.org/
 *    → GCP の承認済みリダイレクト URI にこの URL を登録する必要あり
 * 3. chrome.identity.launchWebAuthFlow で同意画面を開く
 *    Chrome がリダイレクトを自動インターセプトしてレスポンス URL を返す
 *    → /auth/callback ページは不要 (PWA との違い)
 * 4. URL から code を取り出し、/api/auth/exchange に POST
 * 5. refresh_token を chrome.storage.local に保存
 */

import { getApiBaseUrl } from "../lib/env";
import { setRefreshToken } from "../lib/secrets";
import { buildAuthUrl, DEFAULT_SCOPE, generatePkce } from "./oauth";

interface ChromeIdentityLike {
  identity: {
    getRedirectURL(path?: string): string;
    launchWebAuthFlow(options: { url: string; interactive: boolean }): Promise<string>;
  };
}

function getChromeIdentity(): ChromeIdentityLike {
  const c = (globalThis as { chrome?: unknown }).chrome as ChromeIdentityLike | undefined;
  if (!c?.identity) {
    throw new Error("chrome.identity is not available (not running as extension)");
  }
  return c;
}

export interface ExtensionSignInConfig {
  clientId: string;
  scope?: string;
}

export interface ExtensionSignInDeps {
  fetchFn?: typeof fetch;
}

/**
 * Chrome 拡張機能で OAuth フローを実行し、refresh_token を chrome.storage に保存する。
 * 同意画面はポップアップで開き、user が許可すると Chrome が自動でフローを完了させる。
 */
export async function signInExtension(
  config: ExtensionSignInConfig,
  deps: ExtensionSignInDeps = {},
): Promise<void> {
  if (!config.clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID が未設定です。");
  }
  const fetchFn = deps.fetchFn ?? fetch;
  const identity = getChromeIdentity();
  const redirectUri = identity.identity.getRedirectURL();

  const { verifier, challenge } = await generatePkce();
  const state = generateState();
  const authUrl = buildAuthUrl({
    clientId: config.clientId,
    redirectUri,
    scope: config.scope ?? DEFAULT_SCOPE,
    challenge,
    state,
  });

  const redirected = await identity.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });
  if (!redirected) {
    throw new Error("Chrome が認可レスポンスを返しませんでした (キャンセル?)");
  }

  // redirected は "https://<ext-id>.chromiumapp.org/?code=...&state=..." の形式
  const url = new URL(redirected);
  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    throw new Error(`Google 認可エラー: ${errorParam}`);
  }
  if (!code) {
    throw new Error("認可コードがレスポンスに含まれません。");
  }
  if (returnedState !== state) {
    throw new Error("state が一致しません (CSRF の可能性があります)。");
  }

  const apiUrl = `${getApiBaseUrl() || "https://meeting-slot-picker.vercel.app"}/api/auth/exchange`;
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
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(
      `/api/auth/exchange 失敗: ${res.status} ${body.message ?? body.error ?? ""}`,
    );
  }
  const json = (await res.json()) as { refresh_token?: string };
  if (!json.refresh_token) {
    throw new Error("refresh_token がレスポンスに含まれません。");
  }
  await setRefreshToken(json.refresh_token);
}

function generateState(): string {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  let binary = "";
  for (const b of random) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
