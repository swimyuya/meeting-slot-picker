/**
 * Apple Calendar (CalDAV) 連携モーダル。
 *
 * - メールアドレス + アプリ用パスワードの入力
 * - appleid.apple.com への手順説明
 * - パスワードはペースト時に "xxxx-xxxx-xxxx-xxxx" → "xxxxxxxxxxxxxxxx" に正規化
 * - 連携試行 (connectApple) → 成功で onSuccess、失敗で内部エラー表示
 */

import { useState } from "react";
import {
  connectApple,
  normalizeAppPassword,
} from "../auth/apple-connect";
import { APPLE_SPEC } from "../auth/providers";
import { errMessage } from "../lib/error";

interface Props {
  /** モーダルを閉じる (キャンセル or 成功時) */
  onClose: () => void;
  /** 連携成功時に呼ばれる (親で provider 状態を refresh) */
  onSuccess: () => void;
}

export function AppleConnectModal({ onClose, onSuccess }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await connectApple({ email, appPassword: password });
      onSuccess();
      onClose();
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-3 p-4 text-sm">
          <h2 className="text-base font-semibold text-gray-800">
            {APPLE_SPEC.displayName} と連携
          </h2>

          <details className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
            <summary className="cursor-pointer font-medium">
              アプリ用パスワードの取得方法
            </summary>
            <ol className="ml-4 list-decimal space-y-1 pt-2">
              <li>
                <a
                  href={APPLE_SPEC.appPasswordHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 underline"
                >
                  appleid.apple.com
                </a>
                {" "}にサインイン (要 2 要素認証有効化)
              </li>
              <li>「サインインとセキュリティ」→「アプリ用パスワード」</li>
              <li>「+ アプリ用パスワードを生成」</li>
              <li>ラベル例:「日程ピッカー Pro」と入力</li>
              <li>表示された 16 文字 (例 abcd-efgh-ijkl-mnop) をコピー</li>
            </ol>
          </details>

          <label className="block">
            <span className="text-gray-700">Apple ID メールアドレス</span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@icloud.com"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="block">
            <span className="text-gray-700">アプリ用パスワード</span>
            <div className="mt-1 flex items-stretch gap-2">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(normalizeAppPassword(e.target.value))}
                placeholder="xxxxxxxxxxxxxxxx"
                className="w-full rounded border border-gray-300 px-2 py-1.5 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="rounded border border-gray-300 px-2 text-xs"
              >
                {showPassword ? "隠す" : "表示"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              ペースト時のハイフン (-) は自動で除去されます
            </p>
          </label>

          {error && (
            <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 disabled:opacity-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={busy || !email || password.length < 8}
              className="rounded bg-pink-600 px-4 py-1.5 font-medium text-white hover:bg-pink-700 disabled:opacity-50"
            >
              {busy ? "連携中…" : "連携する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
