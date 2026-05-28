import { useCallback, useEffect, useState } from "react";
import { errMessage } from "../lib/error";
import { isTauri } from "../lib/tauri";

export interface UpdateInfo {
  version: string;
  body?: string;
}

/**
 * Tauri アップデータ (`@tauri-apps/plugin-updater`) を起動時にチェックし、
 * 新版が見つかったら state に保持する。applyUpdate で適用 → 再起動。
 */
export function useUpdater() {
  const [available, setAvailable] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    // 起動直後の負荷を避けるため少し遅延
    const timer = setTimeout(async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (cancelled || !update) return;
        if (update.available) {
          setAvailable({ version: update.version, body: update.body });
        }
      } catch (e) {
        if (!cancelled) setError(errMessage(e));
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const applyUpdate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const { relaunch } = await import("@tauri-apps/plugin-process");
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        await relaunch();
      } else {
        setAvailable(null);
      }
    } catch (e) {
      setError(errMessage(e));
      setBusy(false);
    }
  }, []);

  const dismiss = useCallback(() => setAvailable(null), []);

  return { available, busy, error, applyUpdate, dismiss };
}
