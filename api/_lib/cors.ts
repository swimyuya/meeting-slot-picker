/**
 * CORS ヘルパ。許可された origin だけに Allow-Origin を返す。
 * - ALLOWED_ORIGIN env 完全一致 (本番想定: https://meeting-slot-picker.vercel.app)
 * - VERCEL_URL (preview deploy 用) も許可
 * - localhost (dev) も許可
 *
 * Returns true if the request was a preflight and the response is already sent.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

const STATIC_ALLOWED = new Set<string>(
  [process.env.ALLOWED_ORIGIN, "http://localhost:5173", "http://localhost:1420"].filter(
    (s): s is string => Boolean(s),
  ),
);

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED.has(origin)) return true;
  // Vercel preview: https://<branch>-<hash>-<scope>.vercel.app
  if (process.env.VERCEL_URL && origin === `https://${process.env.VERCEL_URL}`) return true;
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return true;
  // Chrome 拡張機能 (Manifest V3 fetch の Origin)。
  // extension-id は a-p 32 文字 (公開時は Chrome Web Store が割当て、
  // dev では manifest.key 由来 or 読込パス由来) なので形式チェックのみ。
  if (/^chrome-extension:\/\/[a-p]{32}$/i.test(origin)) return true;
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
