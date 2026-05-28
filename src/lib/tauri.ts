/** Tauri ランタイムが利用可能か検出するヘルパー.
 *  Vite ブラウザ単独実行 (`npm run dev`) ではモック動作するため、
 *  各呼び出し元はこの関数で分岐する.
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
