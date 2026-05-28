/**
 * 実行時ランタイム検出。
 * 同一の React コードが Tauri ネイティブ / Web (PWA) / Chrome 拡張機能 の3形態で動くため、
 * 各層 (secrets / oauth / token refresh) の分岐に使う。
 *
 * Vite ブラウザ単独実行 (`npm run dev`) ではモック動作するため、各呼び出し元はこの
 * 関数で分岐する。
 */

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri 2.x ではグローバル名前空間 __TAURI_INTERNALS__ で判定可能。
  return (
    "__TAURI_INTERNALS__" in window ||
    "__TAURI__" in window ||
    Boolean((window as unknown as { isTauri?: boolean }).isTauri)
  );
}

/**
 * Chrome 拡張機能 (Manifest V3) のコンテキストで動いているか。
 * chrome.runtime.id が存在することで判定する。Web ページや Tauri では undefined。
 */
export function isExtension(): boolean {
  if (typeof globalThis === "undefined") return false;
  const c = (globalThis as { chrome?: { runtime?: { id?: string } } }).chrome;
  return Boolean(c?.runtime?.id);
}

/** 純粋な Web ランタイム (PWA / 通常のブラウザ) か。Tauri / Extension 以外。 */
export function isWebRuntime(): boolean {
  return !isTauri() && !isExtension();
}
