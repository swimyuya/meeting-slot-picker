/**
 * fetch の差し替え層。
 * - Tauri ランタイムでは plugin-http の fetch を使う (Rust 経由でブラウザ CORS を回避)。
 * - それ以外 (テスト・ブラウザ単独) では globalThis.fetch。
 *
 * これにより calendar/* のロジックを Web 標準 fetch とほぼ同一に保てる。
 */

import { isTauri } from "./tauri";

export type HttpFetch = (url: string, init?: RequestInit) => Promise<Response>;

export const httpFetch: HttpFetch = async (url, init) => {
  if (isTauri()) {
    const { fetch: tauriFetch } = await import("@tauri-apps/plugin-http");
    return tauriFetch(url, init);
  }
  return globalThis.fetch(url, init);
};

/**
 * エラー応答ボディを安全に読み取る。
 * - 読み取り失敗 (接続断など) は空文字にして元のエラーを握り潰さない。
 * - 反射された機密情報の露出やログ肥大を防ぐため max 文字で切り詰める。
 */
export async function safeErrorBody(res: Response, max = 200): Promise<string> {
  const text = await res.text().catch(() => "");
  return text.slice(0, max);
}
