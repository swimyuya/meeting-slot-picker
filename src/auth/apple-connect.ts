/**
 * Apple Calendar (CalDAV) 用の連携関数。
 * OAuth ではなくアプリ用パスワードを保存するだけ。
 *
 * 1. /api/calendar/apple/events に test request (時間範囲 1 日) を投げて
 *    credentials の有効性を確認
 * 2. 成功 → secrets に保存
 * 3. 401 → "Apple ID またはアプリ用パスワードが正しくありません" で throw
 * 4. その他 → 接続エラーとして throw
 */

import { APPLE_EVENTS_PATH } from "../calendar/providers/apple";
import { getApiBaseUrl } from "../lib/env";
import {
  type AppleCredentials,
  setAppleCredentials,
} from "../lib/secrets";

export interface ConnectAppleArgs {
  email: string;
  appPassword: string;
}

export interface ConnectAppleDeps {
  fetchFn?: typeof fetch;
}

/**
 * Apple Calendar に接続。credentials が有効なら secrets に保存。
 */
export async function connectApple(
  args: ConnectAppleArgs,
  deps: ConnectAppleDeps = {},
): Promise<void> {
  const fetchFn = deps.fetchFn ?? fetch;
  const normalizedPassword = normalizeAppPassword(args.appPassword);

  if (!isValidEmail(args.email)) {
    throw new Error("メールアドレスの形式が正しくありません。");
  }
  if (normalizedPassword.length < 8) {
    throw new Error("アプリ用パスワードが短すぎます (16文字を貼り付けてください)。");
  }

  // 検証: 今日から 24 時間の範囲で取得を試みる
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const url = `${getApiBaseUrl()}${APPLE_EVENTS_PATH}`;

  const res = await fetchFn(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: args.email,
      app_password: normalizedPassword,
      time_min: now.toISOString(),
      time_max: tomorrow.toISOString(),
    }),
  });

  if (res.status === 401) {
    throw new Error(
      "Apple ID またはアプリ用パスワードが正しくありません。appleid.apple.com で再発行してください。",
    );
  }
  if (!res.ok) {
    throw new Error(
      "iCloud への接続に失敗しました。時間を置いて再試行してください。",
    );
  }

  const credentials: AppleCredentials = {
    email: args.email,
    password: normalizedPassword,
  };
  await setAppleCredentials(credentials);
}

/** "xxxx-xxxx-xxxx-xxxx" → "xxxxxxxxxxxxxxxx" にハイフンを除去。 */
export function normalizeAppPassword(input: string): string {
  return input.replace(/[\s-]/g, "");
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
