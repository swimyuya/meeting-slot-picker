import { useEffect, useRef } from "react";
import { isTauri } from "../lib/tauri";

/**
 * メニューバー常駐の挙動 (Tauri のみ。他ランタイムでは何もしない):
 *   - Escape キーでウィンドウを隠す
 *   - フォーカス取得時に onFocus (App は now を更新してグリッドを再構築する)
 *   - フォーカス喪失時にウィンドウを隠す — ただし OAuth 連携中 (connecting) は
 *     ブラウザに切り替わった瞬間に消えてしまうため隠さない
 *
 * リスナーはマウント時に一度だけ登録し、最新の connecting / onFocus は ref 経由で
 * 参照する (再登録による listener リークや取りこぼしを避ける)。
 */
export function useTauriMenubar(opts: { connecting: boolean; onFocus: () => void }): void {
  const connectingRef = useRef(opts.connecting);
  useEffect(() => {
    connectingRef.current = opts.connecting;
  }, [opts.connecting]);

  const onFocusRef = useRef(opts.onFocus);
  useEffect(() => {
    onFocusRef.current = opts.onFocus;
  }, [opts.onFocus]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    const hide = async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().hide();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void hide();
    };
    window.addEventListener("keydown", onKey);
    void (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const un = await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (focused) {
          onFocusRef.current();
        } else if (!connectingRef.current) {
          void getCurrentWindow().hide();
        }
      });
      if (cancelled) un();
      else unlisten = un;
    })();
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      unlisten?.();
    };
  }, []);
}
