import { useCallback, useMemo, useState } from "react";
import { PROVIDER_IDS, type ProviderId } from "./auth/providers";
import { AppleConnectModal } from "./components/AppleConnectModal";
import { ConnectPrompt } from "./components/ConnectPrompt";
import { LogoMark } from "./components/icons";
import { MobileDayView } from "./components/MobileDayView";
import { ProviderDots } from "./components/ProviderDots";
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
import { useTauriMenubar } from "./hooks/useTauriMenubar";
import { useUpdater } from "./hooks/useUpdater";
import { copyText } from "./lib/clipboard";
import { isGoogleConfigured, isMicrosoftConfigured } from "./lib/env";
import { providerShortLabel } from "./lib/provider-ui";
import { formatShortcutCompact } from "./lib/shortcut-format";
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
    providerStatus.markExpired,
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

  // メニューバー常駐の挙動 (Tauri のみ)。OAuth 連携中はフォーカス喪失で隠さない。
  useTauriMenubar({
    connecting: providerStatus.busy !== null,
    onFocus: () => setNow(new Date()),
  });

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
  const aggregatedBusyError = useMemo(() => {
    const e: string[] = [];
    for (const p of PROVIDER_IDS) {
      const msg = busyErrors[p];
      if (msg) e.push(`${providerShortLabel(p)}: ${msg}`);
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
        className="flex cursor-grab select-none items-center justify-between border-b border-gray-100 bg-white/90 px-3 py-2 backdrop-blur active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-950/90"
      >
        <span data-tauri-drag-region className="flex items-center gap-2">
          <LogoMark size={18} />
          <span
            data-tauri-drag-region
            className="text-[13px] font-semibold tracking-tight text-gray-800 dark:text-zinc-100"
          >
            日程ピッカー Pro
          </span>
        </span>
        <span data-tauri-drag-region className="flex items-center gap-2.5">
          <ProviderDots connected={providerStatus.connected} />
          <kbd className="kbd">{formatShortcutCompact(config.shortcut)}</kbd>
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
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-gray-400 dark:text-zinc-500">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-brand dark:border-zinc-700 dark:border-t-brand-400" />
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
              now={now}
              onCellDown={onCellDown}
              onCellEnter={onCellEnter}
            />
          ) : (
            <WeekGrid
              columns={columns}
              events={events}
              selection={selection}
              now={now}
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
