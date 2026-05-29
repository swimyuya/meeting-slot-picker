/**
 * Chrome 拡張機能 Service Worker (Manifest V3)。
 *
 * 役割:
 *   1. インストール時のログ出力 (デバッグ用)
 *   2. **OAuth フローの実行** (popup から message を受けて launchWebAuthFlow を呼ぶ)
 *
 * なぜ background で OAuth するか:
 *   popup から chrome.identity.launchWebAuthFlow を呼ぶと OAuth 用の別ウィンドウが
 *   開き、その間に popup がフォーカスを失って **閉じてしまう**。popup の JS context
 *   が死ぬと、`await launchWebAuthFlow(...)` の promise が解決しないままで token
 *   交換が走らない。
 *
 *   Service Worker は popup が閉じても生き続けるため、ここで OAuth 全体を完結させる
 *   ことで連携を確実に成功させる。
 */

import { signInExtension } from "../src/auth/oauth-extension";
import type { OAuthProviderId } from "../src/auth/providers";

interface OAuthStartMessage {
  type: "oauth_start";
  provider: OAuthProviderId;
  config: { clientId: string; scope?: string };
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("[meeting-slot-picker-pro] installed");
  }
});

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isOAuthStartMessage(message)) return false;
    void (async () => {
      try {
        await signInExtension(message.provider, message.config);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : "unknown error",
        });
      }
    })();
    return true; // 非同期で sendResponse するのでチャネルを保持する
  },
);

function isOAuthStartMessage(m: unknown): m is OAuthStartMessage {
  if (typeof m !== "object" || m === null) return false;
  const obj = m as Record<string, unknown>;
  if (obj.type !== "oauth_start") return false;
  if (obj.provider !== "google" && obj.provider !== "microsoft") return false;
  if (typeof obj.config !== "object" || obj.config === null) return false;
  const cfg = obj.config as Record<string, unknown>;
  return typeof cfg.clientId === "string";
}
