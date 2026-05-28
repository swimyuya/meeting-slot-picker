/**
 * Chrome 拡張機能 (Manifest V3) 用 OAuth フロー — provider 共通。
 *
 * フロー:
 *   1. PKCE verifier/challenge と state を生成 (provider 仕様を反映)
 *   2. redirect_uri = chrome.identity.getRedirectURL()  ← https://<ext-id>.chromiumapp.org/
 *   3. chrome.identity.launchWebAuthFlow で同意画面を開く
 *      Chrome がリダイレクトを自動インターセプトしてレスポンス URL を返す
 *   4. URL から code を取り出し、/api/auth/exchange に provider 付きで POST
 *   5. refresh_token を chrome.storage.local に provider 別キーで保存
 *      + id_token から email 抽出して identity 保存
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
import {
  getOAuthProviderSpec,
  getProviderSpec,
  type OAuthProviderId,
} from "./providers";

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
 */
export async function signInExtension(
  provider: OAuthProviderId,
  config: ExtensionSignInConfig,
  deps: ExtensionSignInDeps = {},
): Promise<void> {
  if (!config.clientId) {
    throw new Error(
      `${getProviderSpec(provider).displayName}: client_id が未設定です。`,
    );
  }
  const fetchFn = deps.fetchFn ?? fetch;
  const identity = getChromeIdentity();
  const redirectUri = identity.identity.getRedirectURL();
  const spec = getOAuthProviderSpec(provider);

  const { verifier, challenge } = await generatePkce();
  const state = generateState();
  const authUrl = buildAuthUrl(spec, {
    clientId: config.clientId,
    redirectUri,
    scope: config.scope ?? spec.defaultScope,
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
    throw new Error(`認可エラー: ${errorParam}`);
  }
  if (!code) {
    throw new Error("認可コードがレスポンスに含まれません。");
  }
  if (returnedState !== state) {
    throw new Error("state が一致しません (CSRF の可能性があります)。");
  }

  // 環境変数 VITE_API_BASE_URL から取得。Pro 拡張ビルドでは必ず設定する想定。
  // 未設定なら明示的にエラーで知らせる (静的フォールバックで本番 URL を叩く事故を防ぐ)。
  const apiBase = getApiBaseUrl();
  if (!apiBase) {
    throw new Error(
      "VITE_API_BASE_URL が未設定です。拡張ビルド時に環境変数を設定してください。",
    );
  }
  const apiUrl = `${apiBase}/api/auth/exchange`;
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
    const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(
      `/api/auth/exchange 失敗: ${res.status} ${body.message ?? body.error ?? ""}`,
    );
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
}
