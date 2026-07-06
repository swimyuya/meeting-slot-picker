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
import { AppleGlyph } from "./icons";

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
    <div className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-black/40 p-3 backdrop-blur-sm">
      <div className="card w-full max-w-md animate-scale-in overflow-hidden shadow-pop">
        <form onSubmit={handleSubmit} className="space-y-3.5 p-5 text-sm">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-gray-200/70 dark:bg-zinc-800 dark:ring-zinc-700">
              <AppleGlyph size={17} className="text-gray-900 dark:text-zinc-100" />
            </span>
            <h2 className="text-base font-bold tracking-tight text-gray-900 dark:text-zinc-50">
              {APPLE_SPEC.displayName} と連携
            </h2>
          </div>

          <details className="rounded-lg border border-gray-200/80 bg-gray-50 p-2.5 text-xs text-gray-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
            <summary className="cursor-pointer font-medium text-gray-700 dark:text-zinc-200">
              アプリ用パスワードの取得方法
            </summary>
            <ol className="ml-4 list-decimal space-y-1 pt-2">
              <li>
                <a
                  href={APPLE_SPEC.appPasswordHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline hover:text-brand-700 dark:text-brand-400"
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
            <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">
              Apple ID メールアドレス
            </span>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@icloud.com"
              className="input mt-1 py-2 text-sm"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">
              アプリ用パスワード
            </span>
            <div className="mt-1 flex items-stretch gap-2">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(normalizeAppPassword(e.target.value))}
                placeholder="xxxxxxxxxxxxxxxx"
                className="input py-2 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="btn btn-secondary px-2.5 text-xs"
              >
                {showPassword ? "隠す" : "表示"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-500">
              ペースト時のハイフン (-) は自動で除去されます
            </p>
          </label>

          {error && <p className="alert-error">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="btn btn-ghost px-3 py-2"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={busy || !email || password.length < 8}
              className="btn px-4 py-2 text-sm font-medium bg-gray-900 text-white shadow-sm hover:bg-gray-800 active:scale-[0.98] dark:bg-white dark:text-gray-900 dark:hover:bg-zinc-200"
            >
              {busy ? "連携中…" : "連携する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
