import { useEffect, useState } from "react";
import { errMessage } from "../lib/error";
import { isTauri } from "../lib/tauri";

/**
 * グローバルショートカットを config.shortcut に従って動的登録する。
 * - spec が変わったら古いものを unregister → 新しいものを register
 * - Rust 側の plugin の with_handler が登録ショートカット押下時に toggle_popup を呼ぶ
 *   (登録 spec のいずれかが押されたら毎回トグル発火、という単一ハンドラ)
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
        if (cancelled) return;
        // 念のため、登録済みなら一度 unregister してから登録 (重複防止)
        try {
          if (await gs.isRegistered(spec)) await gs.unregister(spec);
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        await gs.register(spec);
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
