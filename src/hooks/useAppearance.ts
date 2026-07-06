import { useEffect } from "react";
import {
  APPEARANCE_CACHE_KEY,
  applyAppearance,
  type Appearance,
} from "../lib/appearance-boot";

/**
 * 設定の外観 (自動/ライト/ダーク) を <html> の dark クラスに反映する。
 * - dark / light: 強制適用
 * - auto: OS の外観に追従し、変更イベントも購読する
 * 次回起動のちらつき防止のため、値を localStorage にキャッシュする
 * (描画前ブートの appearance-boot.ts が読む)。
 */
export function useAppearance(appearance: Appearance): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    applyAppearance(appearance);
    try {
      localStorage.setItem(APPEARANCE_CACHE_KEY, appearance);
    } catch {
      /* プライベートモード等で書けない場合は諦める (auto 扱いで起動する) */
    }
    if (appearance !== "auto" || !window.matchMedia) return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyAppearance("auto");
    if (mql.addEventListener) {
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, [appearance]);
}
