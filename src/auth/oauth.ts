/**
 * OAuth エントリポイント — ランタイム dispatch + Tauri (デスクトップ) フロー。
 *
 * 実行環境による dispatch (connect):
 *   - Chrome 拡張機能 → background SW へ委譲 (signInExtension が SW 内で実行される)
 *   - Web (PWA)      → signInWeb (リダイレクトして return しない)
 *   - Tauri          → loopback + PKCE で本ファイル内で完結
 *
 * デスクトップフロー:
 *   1. PKCE (verifier / S256 challenge) を生成
 *   2. 認可 URL を組み立て、Rust 側 (oauth_capture_code) が loopback サーバ起動＋ブラウザを開く
 *   3. リダイレクトの ?code= を受け取り、token endpoint で refresh_token に交換
 *   4. refresh_token を Keychain に provider 別キーで保存
 *   5. id_token から email を取り出して identity ストアに保存 (将来のサブスク用)
 *
 * PKCE / URL 組み立て / token 交換などの共有プリミティブは oauth-core.ts に置き、
 * ここから re-export する (既存 import 互換)。
 */

import { getWebRedirectUri } from "../lib/env";
import { type HttpFetch } from "../lib/http";
import { setRefreshToken } from "../lib/secrets";
import { isExtension, isTauri } from "../lib/tauri";
import {
  exchangeCode,
  persistIdentityIfPossible,
  prepareAuthRequest,
  requireClientId,
} from "./oauth-core";
import { getOAuthProviderSpec, type OAuthProviderId } from "./providers";

export {
  base64UrlEncode,
  buildAuthUrl,
  exchangeCode,
  generatePkce,
  generateState,
  persistIdentityIfPossible,
} from "./oauth-core";

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
 * OAuth フロー全体を実行する。実行環境を判定して適切なフローへ dispatch する。
 * テスト時は deps.captureCode が指定されるので、その場合は Tauri 経路に流す。
 */
export async function connect(
  provider: OAuthProviderId,
  config: OAuthConfig,
  deps: OAuthDeps = {},
): Promise<void> {
  requireClientId(provider, config.clientId, " (.env.local を確認してください)");

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

  await connectDesktop(provider, config, deps);
}

/** Tauri loopback フロー本体。 */
async function connectDesktop(
  provider: OAuthProviderId,
  config: OAuthConfig,
  deps: OAuthDeps,
): Promise<void> {
  const spec = getOAuthProviderSpec(provider);
  const port = config.port ?? spec.defaultPort;
  // RFC 8252 準拠で 127.0.0.1 を使う (localhost だと IPv6 解決で取りこぼす恐れ)。
  const redirectUri = `http://127.0.0.1:${port}`;

  const { verifier, state, authUrl } = await prepareAuthRequest(spec, {
    clientId: config.clientId,
    redirectUri,
    scope: config.scope,
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
