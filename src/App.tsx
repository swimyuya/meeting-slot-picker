import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConnectPrompt } from "./components/ConnectPrompt";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toolbar } from "./components/Toolbar";
import { UpdateBanner } from "./components/UpdateBanner";
import { WeekGrid } from "./components/WeekGrid";
import { format } from "./domain/formatter";
import { collectSelectedSlots } from "./domain/selectors";
import { applyEvents, buildSlotGrid, deriveEffectiveOptions } from "./domain/slots";
import { useAuthStatus } from "./hooks/useAuthStatus";
import { useBusyTimes } from "./hooks/useBusyTimes";
import { useConfig } from "./hooks/useConfig";
import { useSelection } from "./hooks/useSelection";
import { useShortcut } from "./hooks/useShortcut";
import { useUpdater } from "./hooks/useUpdater";
import { copyText } from "./lib/clipboard";
import { isClientIdConfigured } from "./lib/env";
import { isTauri } from "./lib/tauri";

/** アプリのルート。連携状態に応じて連携案内 / 設定 / 週グリッドを切り替える。 */
export function App() {
  const [now, setNow] = useState(() => new Date());
  const { config, loaded, update } = useConfig();
  const { connected, busy: authBusy, error: authError, connect, disconnect } = useAuthStatus();
  const { events, loading, error: busyError, reload } = useBusyTimes(
    connected === true,
    config,
    now,
  );
  const { selection, onCellDown, onCellEnter, clearAll } = useSelection();
  // config.shortcut に従ってグローバルショートカットを動的に登録 (変更時は再登録)。
  useShortcut(config.shortcut);
  const updater = useUpdater();
  const [showSettings, setShowSettings] = useState(false);

  // 予定に合わせて表示範囲を自動拡張 (時間外・週末の予定も全部見えるように)。
  const effectiveOpts = useMemo(() => deriveEffectiveOptions(config, events), [config, events]);
  const columns = useMemo(
    () => applyEvents(buildSlotGrid(now, effectiveOpts), events),
    [now, effectiveOpts, events],
  );
  const selectedSlots = useMemo(
    () => collectSelectedSlots(columns, selection),
    [columns, selection],
  );
  const preview = useMemo(
    () => format(selectedSlots, { template: config.template, rangeSeparator: config.rangeSeparator }),
    [selectedSlots, config.template, config.rangeSeparator],
  );

  const handleCopy = useCallback(async () => {
    await copyText(preview);
  }, [preview]);

  // OAuth 連携中はフォーカス喪失で隠さない (ブラウザに移ると消えてしまうのを防ぐ)。
  const connectingRef = useRef(false);
  useEffect(() => {
    connectingRef.current = authBusy;
  }, [authBusy]);

  // メニューバー常駐の挙動 (Tauri のみ):
  //  - 開く (フォーカス取得) たびに now を更新 → 当日基準でグリッド/予定を再取得
  //  - フォーカス喪失 / Esc で隠す (連携中を除く)
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
          setNow(new Date());
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

  return (
    <div className="flex h-full flex-col">
      <header
        data-tauri-drag-region
        title="ドラッグして移動"
        className="flex cursor-grab items-center justify-between border-b bg-gray-50 px-3 py-2 select-none active:cursor-grabbing"
      >
        <span data-tauri-drag-region className="text-xs font-semibold text-gray-700">
          日程ピッカー
        </span>
        <span data-tauri-drag-region className="text-[10px] text-gray-400">
          {config.shortcut
            .replace("CmdOrControl", "Ctrl")
            .replace("Control", "Ctrl")
            .replace("Cmd", "⌘")
            .replace(/Key([A-Z])/g, "$1")
            .replace(/\+/g, "+")}
        </span>
      </header>
      {updater.available && (
        <UpdateBanner
          version={updater.available.version}
          busy={updater.busy}
          error={updater.error}
          onApply={() => void updater.applyUpdate()}
          onDismiss={updater.dismiss}
        />
      )}

      {!loaded || connected === null ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          読み込み中…
        </div>
      ) : connected === false ? (
        <ConnectPrompt
          onConnect={() => void connect()}
          busy={authBusy}
          error={authError}
          clientIdMissing={!isClientIdConfigured()}
        />
      ) : showSettings ? (
        <SettingsPanel config={config} onSave={update} onClose={() => setShowSettings(false)} />
      ) : (
        <>
          <WeekGrid
            columns={columns}
            events={events}
            selection={selection}
            onCellDown={onCellDown}
            onCellEnter={onCellEnter}
          />
          <Toolbar
            preview={preview}
            count={selectedSlots.length}
            loading={loading}
            error={busyError}
            busyCount={events.length}
            onCopy={handleCopy}
            onClear={clearAll}
            onReload={reload}
            onSettings={() => setShowSettings(true)}
            onDisconnect={() => void disconnect()}
          />
        </>
      )}
    </div>
  );
}
