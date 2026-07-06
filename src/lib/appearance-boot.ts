/**
 * 外観 (ライト/ダーク) の描画前ブート。エントリ (main.tsx / popup.tsx) の先頭で
 * import され、React マウント前に <html> へ dark クラスを適用してちらつきを防ぐ。
 *
 * 設定の正本は AppConfig.appearance (plugin-store / localStorage)。ここでは
 * useAppearance が書き込むキャッシュ (localStorage) だけを読む — Tauri の
 * plugin-store は同期読み出しできないため。キャッシュが無ければ OS 追従。
 *
 * MV3 拡張はページ内インライン <script> を禁止しているため、モジュール import
 * 方式にして 3 配布形態 (Tauri / PWA / 拡張) で同じ仕組みを使う。
 */

export const APPEARANCE_CACHE_KEY = "msp:appearance";

export type Appearance = "auto" | "light" | "dark";

/** 保存済み外観設定を <html> に適用する (boot 時 + useAppearance から利用)。 */
export function applyAppearance(appearance: Appearance): void {
  if (typeof document === "undefined") return;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
  const dark = appearance === "dark" || (appearance === "auto" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

/** localStorage のキャッシュから外観を読む (不正値は auto)。 */
export function readCachedAppearance(): Appearance {
  try {
    const v = localStorage.getItem(APPEARANCE_CACHE_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

// import された瞬間に適用 (副作用モジュール)
applyAppearance(readCachedAppearance());
