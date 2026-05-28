/**
 * /auth/callback ルートのハンドラ。
 * Google から code/state 付きで戻ってきた直後にマウントされ、
 * /api/auth/exchange に code を投げて refresh_token を取り、IndexedDB に保存して
 * ルートに遷移する。
 */

import { useEffect, useState } from "react";
import { handleAuthCallback } from "../auth/oauth-web";
import { errMessage } from "../lib/error";

export function CallbackPage() {
  const [status, setStatus] = useState<"working" | "error">("working");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await handleAuthCallback();
        if (cancelled) return;
        // ルートに遷移 (履歴は残さない)。SPA の遷移ではなくフル遷移にして
        // useAuthStatus を含む全ての状態を再初期化する。
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
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
        <p className="text-sm text-gray-600">Google アカウントに連携中…</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-semibold text-red-600">連携に失敗しました</p>
      {error && (
        <p className="break-all text-xs text-gray-600">
          {classifyError(error)}
        </p>
      )}
      <a
        href="/"
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
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
