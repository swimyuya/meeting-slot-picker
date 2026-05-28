import { useEffect, useState } from "react";
import { errMessage } from "../lib/error";
import { isTauri } from "../lib/tauri";

/**
 * グローバルショートカットを config.shortcut に従って動的登録する。
 * - spec が変わったら古いものを unregister → 新しいものを register
 * - 押下時の handler は Rust の `toggle_window` コマンドを invoke してウィンドウをトグルする
 */
export function useShortcut(spec: string): { error: string | null } {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri() || !spec) {
      setError(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const gs = await import("@tauri-apps/plugin-global-shortcut");
        const { invoke } = await import("@tauri-apps/api/core");
        if (cancelled) return;
        // 念のため、登録済みなら一度 unregister してから登録 (重複防止)
        try {
          if (await gs.isRegistered(spec)) await gs.unregister(spec);
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        // 押下時のみ Rust の toggle_window コマンドを呼ぶ (Released は無視)
        await gs.register(spec, (event) => {
          if (event.state === "Pressed") {
            void invoke("toggle_window").catch(() => {});
          }
        });
        setError(null);
      } catch (e) {
        setError(errMessage(e));
      }
    })();
    return () => {
      cancelled = true;
      void (async () => {
        try {
          const gs = await import("@tauri-apps/plugin-global-shortcut");
          await gs.unregister(spec);
        } catch {
          /* ignore */
        }
      })();
    };
  }, [spec]);

  return { error };
}
