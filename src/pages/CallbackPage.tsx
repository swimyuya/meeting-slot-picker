/**
 * /auth/callback ルートのハンドラ。
 * Google または Microsoft から code/state 付きで戻ってきた直後にマウントされ、
 * /api/auth/exchange に code を投げて refresh_token を取り、保存してルートに遷移する。
 */

import { useEffect, useState } from "react";
import { handleAuthCallback, PROVIDER_KEY } from "../auth/oauth-web";
import { errMessage } from "../lib/error";
import { providerShortLabel } from "../lib/provider-ui";

/** sessionStorage から provider を読んで表示名を返す。 */
function getInProgressProviderLabel(): string {
  try {
    const p = sessionStorage.getItem(PROVIDER_KEY);
    if (p === "microsoft" || p === "google") return providerShortLabel(p);
  } catch {
    /* ignore */
  }
  return "カレンダー";
}

export function CallbackPage() {
  const [status, setStatus] = useState<"working" | "error">("working");
  const [error, setError] = useState<string | null>(null);
  const [providerLabel] = useState<string>(() => getInProgressProviderLabel());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await handleAuthCallback();
        if (cancelled) return;
        // ルートに遷移 (履歴は残さない)。SPA の遷移ではなくフル遷移にして
        // useProviderStatus を含む全ての状態を再初期化する。
        window.location.replace("/");
      } catch (e) {
        if (cancelled) return;
        setError(errMessage(e));
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "working") {
    return (
      <div className="flex h-full animate-fade-in flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-brand dark:border-zinc-700 dark:border-t-brand-400" />
        <p className="text-sm text-gray-600 dark:text-zinc-300">{providerLabel} アカウントに連携中…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full animate-fade-in-up flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-semibold text-red-600 dark:text-red-400">連携に失敗しました</p>
      {error && (
        <p className="max-w-sm break-all text-xs leading-5 text-gray-600 dark:text-zinc-400">
          {classifyError(error)}
        </p>
      )}
      <a href="/" className="btn btn-primary px-4 py-2 text-sm">
        トップに戻ってやり直す
      </a>
    </div>
  );
}

/**
 * 内部エラー文字列を user 向けの短いメッセージに変換する。
 * - 既知のキーワード (state / 認可エラー / セッション / refresh_token) を識別して定型文を返す
 * - それ以外は「不明なエラーが発生しました」(原文は隠す)
 *
 * これにより内部実装の詳細 (HTTP ステータス・error_description) を外に出さない。
 */
function classifyError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("state")) return "セキュリティ検証 (state) に失敗しました。もう一度やり直してください。";
  if (s.includes("セッション")) return "セッションが見つかりませんでした。もう一度連携を始めてください。";
  if (s.includes("access_denied") || s.includes("認可エラー")) return "Google / Outlook 側で認可が許可されませんでした。";
  if (s.includes("refresh_token")) return "リフレッシュトークンを取得できませんでした。連携設定を解除して再試行してください。";
  if (s.includes("/api/auth/exchange") || s.includes("exchange")) return "サーバとのトークン交換に失敗しました。時間を置いて再試行してください。";
  return "連携に失敗しました。時間を置いて再度お試しください。";
}
