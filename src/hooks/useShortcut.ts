import { useEffect, useState } from "react";
import { errMessage } from "../lib/error";
import { isTauri } from "../lib/tauri";

/**
 * Tauri プラグインは Web/拡張バンドルへ含めないため動的 import する。
 * spec 変更で effect が再実行されるたびに import() を評価し直すと、
 * vitest のモック解決が同一 callsite の 2 回目以降で外れる quirk を踏むため、
 * 初回の import promise をモジュールスコープで再利用する (実体は ESM キャッシュ
 * により元々単一なので、実行時挙動は変わらない)。
 */
let tauriModsPromise: Promise<{
  gs: typeof import("@tauri-apps/plugin-global-shortcut");
  invoke: typeof import("@tauri-apps/api/core").invoke;
}> | null = null;

function loadTauriMods() {
  tauriModsPromise ??= (async () => {
    const gs = await import("@tauri-apps/plugin-global-shortcut");
    const { invoke } = await import("@tauri-apps/api/core");
    return { gs, invoke };
  })();
  return tauriModsPromise;
}

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
        const { gs, invoke } = await loadTauriMods();
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
          const { gs } = await loadTauriMods();
          await gs.unregister(spec);
        } catch {
          /* ignore */
        }
      })();
    };
  }, [spec]);

  return { error };
}
