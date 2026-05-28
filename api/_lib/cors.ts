/**
 * CORS ヘルパ。許可された origin だけに Allow-Origin を返す。
 *
 * 許可ロジック (上から順に判定):
 *   1. ALLOWED_ORIGIN env 完全一致 (本番想定)
 *   2. 現在の deploy 自身の URL (VERCEL_URL)
 *   3. EXTENSION_ID env が設定されていれば その chrome-extension://<id>
 *   4. dev 用 localhost (env で明示)
 *
 * セキュリティ上の重要点:
 *   - 任意の `*.vercel.app` を許可しない (誰でも作成可能なため攻撃者の preview から
 *     OAuth token endpoint を叩けてしまう)
 *   - chrome-extension:// のワイルドカードを許可しない (任意の拡張から API を叩ける)
 *
 * Returns true if the request was a preflight and the response is already sent.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * env を実行時 (関数呼び出し時) に評価する。
 * テストで env を変更したい / Vercel function の cold start 後に env が変わる場合に対応。
 */
function getStaticAllowed(): Set<string> {
  const isProd = process.env.NODE_ENV === "production";
  return new Set<string>(
    [
      process.env.ALLOWED_ORIGIN,
      // dev: 明示的に許可 (本番では含めない)
      !isProd ? "http://localhost:5173" : null,
      !isProd ? "http://localhost:1420" : null,
    ].filter((s): s is string => Boolean(s)),
  );
}

/** 環境変数 EXTENSION_ID (32文字 a-p) で許可する拡張機能 origin を1つ追加可能。 */
function getExtensionOrigin(): string | null {
  const id = (process.env.EXTENSION_ID ?? "").trim();
  if (!id || !/^[a-p]{32}$/i.test(id)) return null;
  return `chrome-extension://${id}`;
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (getStaticAllowed().has(origin)) return true;
  // 現在の deploy 自身の URL (本番 / production preview)
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) return true;
  // 環境変数で明示された拡張機能 ID のみ許可
  const ext = getExtensionOrigin();
  if (ext && origin === ext) return true;
  return false;
}

/** Sets CORS headers if the origin is allowed; handles preflight. Returns true if handled (preflight). */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}
