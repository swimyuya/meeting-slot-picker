import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PROVIDER_IDS, type ProviderId } from "./auth/providers";
import { AppleConnectModal } from "./components/AppleConnectModal";
import { ConnectPrompt } from "./components/ConnectPrompt";
import { MobileDayView } from "./components/MobileDayView";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toolbar } from "./components/Toolbar";
import { UpdateBanner } from "./components/UpdateBanner";
import { WeekGrid } from "./components/WeekGrid";
import { format } from "./domain/formatter";
import { collectSelectedSlots } from "./domain/selectors";
import { applyEvents, buildSlotGrid, deriveEffectiveOptions } from "./domain/slots";
import { useBusyTimes } from "./hooks/useBusyTimes";
import { useConfig } from "./hooks/useConfig";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { useProviderStatus } from "./hooks/useProviderStatus";
import { useSelection } from "./hooks/useSelection";
import { useShortcut } from "./hooks/useShortcut";
import { useUpdater } from "./hooks/useUpdater";
import { copyText } from "./lib/clipboard";
import { isGoogleConfigured, isMicrosoftConfigured } from "./lib/env";
import { isTauri } from "./lib/tauri";
import { CallbackPage } from "./pages/CallbackPage";

/** アプリのルート。連携状態に応じて連携案内 / 設定 / 週グリッドを切り替える。 */
export function App() {
  // OAuth コールバック専用ルート (PWA フローでのみ使用)。
  if (typeof window !== "undefined" && window.location.pathname === "/auth/callback") {
    return <CallbackPage />;
  }
  return <MainApp />;
}

function MainApp() {
  const [now, setNow] = useState(() => new Date());
  const { config, loaded, update } = useConfig();
  const providerStatus = useProviderStatus();
  const { events, loading, errors: busyErrors, reload } = useBusyTimes(
    providerStatus.connected,
    config,
    now,
  );
  const { selection, onCellDown, onCellEnter, clearAll } = useSelection();
  // config.shortcut に従ってグローバルショートカットを動的に登録 (変更時は再登録)。
  useShortcut(config.shortcut);
  const updater = useUpdater();
  const [showSettings, setShowSettings] = useState(false);
  const [showAppleModal, setShowAppleModal] = useState(false);
  // モバイル幅では1日スワイプビュー、PCではカレンダー風週グリッドに切り替え。
  const isMobile = useMediaQuery("(max-width: 768px)");

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
    connectingRef.current = providerStatus.busy !== null;
  }, [providerStatus.busy]);

  // メニューバー常駐の挙動 (Tauri のみ)
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

  const configMissing = useMemo<Record<ProviderId, boolean>>(
    () => ({
      google: !isGoogleConfigured(),
      microsoft: !isMicrosoftConfigured(),
      // Apple は環境変数不要 (ユーザーが連携時にアプリ用パスワードを入力)
      apple: false,
    }),
    [],
  );

  // 連携済 provider がひとつでもあれば main app、ゼロなら ConnectPrompt
  const showConnectPrompt = providerStatus.allKnown && !providerStatus.hasAny;
  const showLoading = !loaded || !providerStatus.allKnown;

  // 表示用の合計 busy 数とエラー文字列 (複数 provider のうち最初のエラーを表示)
  const providerLabel = (p: ProviderId): string =>
    p === "microsoft" ? "Outlook" : p === "apple" ? "Apple" : "Google";
  const aggregatedBusyError = useMemo(() => {
    const e: string[] = [];
    for (const p of PROVIDER_IDS) {
      const msg = busyErrors[p];
      if (msg) e.push(`${providerLabel(p)}: ${msg}`);
    }
    return e.length > 0 ? e.join(" / ") : null;
  }, [busyErrors]);

  /** Connect ハンドラ。Apple はモーダル経路、それ以外は通常の OAuth 経路。 */
  const handleConnect = (p: ProviderId) => {
    if (p === "apple") {
      setShowAppleModal(true);
      return;
    }
    void providerStatus.connect(p);
  };

  return (
    <div className="flex h-full flex-col">
      <header
        data-tauri-drag-region
        title="ドラッグして移動"
        className="flex cursor-grab items-center justify-between border-b bg-gray-50 px-3 py-2 select-none active:cursor-grabbing"
      >
        <span data-tauri-drag-region className="text-xs font-semibold text-gray-700">
          日程ピッカー Pro
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

      {showLoading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          読み込み中…
        </div>
      ) : showConnectPrompt ? (
        <ConnectPrompt
          onConnect={handleConnect}
          busy={providerStatus.busy}
          errors={providerStatus.error}
          configMissing={configMissing}
        />
      ) : showSettings ? (
        <SettingsPanel
          config={config}
          onSave={update}
          onClose={() => setShowSettings(false)}
          providerStatus={providerStatus}
          configMissing={configMissing}
          onOpenAppleModal={() => setShowAppleModal(true)}
        />
      ) : (
        <>
          {isMobile ? (
            <MobileDayView
              columns={columns}
              events={events}
              selection={selection}
              onCellDown={onCellDown}
              onCellEnter={onCellEnter}
            />
          ) : (
            <WeekGrid
              columns={columns}
              events={events}
              selection={selection}
              onCellDown={onCellDown}
              onCellEnter={onCellEnter}
            />
          )}
          <Toolbar
            preview={preview}
            count={selectedSlots.length}
            loading={loading}
            error={aggregatedBusyError}
            busyCount={events.length}
            onCopy={handleCopy}
            onClear={clearAll}
            onReload={reload}
            onSettings={() => setShowSettings(true)}
            onDisconnect={() => void providerStatus.disconnect("google")}
          />
        </>
      )}

      {showAppleModal && (
        <AppleConnectModal
          onClose={() => setShowAppleModal(false)}
          onSuccess={() => void providerStatus.refreshConnected()}
        />
      )}
    </div>
  );
}
