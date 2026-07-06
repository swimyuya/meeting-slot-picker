import { useState } from "react";
import { IconCheck, IconCopy, IconGear, IconRefresh, IconUnlink, IconX } from "./icons";

interface Props {
  preview: string;
  count: number;
  loading: boolean;
  error: string | null;
  /** freeBusy で取得した予定件数 (表示範囲内)。 */
  busyCount?: number;
  onCopy: () => Promise<void>;
  onClear: () => void;
  onReload: () => void;
  onSettings: () => void;
  onDisconnect: () => void;
}

/** 下部ツールバー: プレビュー・コピー・クリア・再取得・設定・連携解除。 */
export function Toolbar({
  preview,
  count,
  loading,
  error,
  busyCount = 0,
  onCopy,
  onClear,
  onReload,
  onSettings,
  onDisconnect,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await onCopy();
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-2 border-t border-gray-100 bg-gray-50/90 p-2.5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
      <textarea
        readOnly
        value={preview}
        aria-label="コピー内容プレビュー"
        placeholder="空き枠を選択するとここに表示されます"
        className="input h-16 resize-none leading-5"
      />
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <button
          type="button"
          disabled={count === 0}
          onClick={handleCopy}
          className={`btn px-3 py-2 ${
            copied
              ? "bg-emerald-600 text-white shadow-sm"
              : "btn-primary"
          }`}
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied ? "コピーしました ✓" : `コピー（${count}枠）`}
        </button>
        <button
          type="button"
          disabled={count === 0}
          onClick={onClear}
          title="選択をクリア"
          className="btn btn-secondary px-2.5 py-2"
        >
          <IconX size={12} />
          クリア
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onReload}
          title="予定を再取得"
          className="btn btn-secondary px-2.5 py-2"
        >
          <IconRefresh size={12} className={loading ? "animate-spin" : undefined} />
          {loading ? "更新中…" : "再取得"}
        </button>
        <span
          className="whitespace-nowrap rounded-full bg-gray-200/70 px-2 py-1 text-[10px] tabular-nums text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
          title="取得した表示範囲内の予定件数"
        >
          予定 {busyCount} 件
        </span>
        <div
          data-tauri-drag-region
          className="flex-1 cursor-grab active:cursor-grabbing"
          title="ドラッグして移動"
        />
        <button type="button" onClick={onSettings} className="btn btn-ghost px-2 py-2">
          <IconGear size={13} />
          設定
        </button>
        <button type="button" onClick={onDisconnect} className="btn btn-danger-ghost px-2 py-2">
          <IconUnlink size={13} />
          連携解除
        </button>
      </div>
      {error && <p className="alert-error">{error}</p>}
      {copyError && <p className="alert-error">コピーに失敗しました: {copyError}</p>}
    </div>
  );
}
