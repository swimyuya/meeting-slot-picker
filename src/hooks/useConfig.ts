import { useCallback, useEffect, useState } from "react";
import { DEFAULT_CONFIG, loadConfig, saveConfig, type AppConfig } from "../lib/config";

/** AppConfig を読み込み・保存するフック。 */
export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void loadConfig().then((c) => {
      if (!active) return;
      setConfig(c);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(async (next: AppConfig) => {
    setConfig(next); // 楽観的更新 (イミュータブル: 新オブジェクト)
    await saveConfig(next);
  }, []);

  return { config, loaded, update };
}
